import { db as defaultDb, type AppDatabase } from '../db/db';
import {
  DEFAULT_USER_DATA,
  hasUserData,
  newId,
  now,
  type Book,
  type Chapter,
  type Technique,
} from '../model/types';
import { ImportError, Problems, isRecord, parseJson } from './validation';

export const BOOK_SCHEMA_VERSION = 1;

/** External Book definition file. Carries structure only, never user progress. */
export interface BookFile {
  schemaVersion: number;
  type: 'book';
  book: BookDef;
}

export interface BookDef {
  externalId: string;
  name: string;
  version?: string;
  description?: string;
  chapters: ChapterDef[];
}

export interface ChapterDef {
  externalId: string;
  name: string;
  techniques: TechniqueDef[];
}

export interface TechniqueDef {
  externalId: string;
  name: string;
}

export interface BookImportSummary {
  bookId: string;
  bookName: string;
  createdBook: boolean;
  techniquesAdded: number;
  techniquesUpdated: number;
  techniquesOrphaned: number;
  techniquesRemoved: number;
  chaptersAdded: number;
  chaptersOrphaned: number;
  chaptersRemoved: number;
}

// ------------------------------------------------------------ validation

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/** Parse and validate a Book file. Throws `ImportError` listing every problem found. */
export function parseBookFile(text: string): BookFile {
  return validateBookFile(parseJson(text));
}

export function validateBookFile(raw: unknown): BookFile {
  const p = new Problems();
  if (!isRecord(raw)) throw new ImportError('Book file must be a JSON object');
  if (raw.type !== 'book') p.add('type', `expected "book", got ${JSON.stringify(raw.type)}`);
  if (typeof raw.schemaVersion !== 'number') p.add('schemaVersion', 'missing or not a number');
  else if (raw.schemaVersion > BOOK_SCHEMA_VERSION)
    p.add('schemaVersion', `version ${raw.schemaVersion} is newer than this app supports`);
  p.throwIfAny('Not a Book file');

  const migrated = migrateBookFile(raw);
  const book = migrated.book;
  if (!isRecord(book)) throw new ImportError('Book file has no "book" object');

  if (!nonEmptyString(book.externalId)) p.add('book.externalId', 'required');
  if (!nonEmptyString(book.name)) p.add('book.name', 'required');
  if (book.version !== undefined && typeof book.version !== 'string')
    p.add('book.version', 'must be a string');
  if (book.description !== undefined && typeof book.description !== 'string')
    p.add('book.description', 'must be a string');
  if (!Array.isArray(book.chapters)) p.add('book.chapters', 'must be an array');

  const chapterIds = new Set<string>();
  const techniqueIds = new Set<string>();
  const rawChapters: unknown[] = Array.isArray(book.chapters) ? book.chapters : [];
  const chapters = rawChapters.map((c, ci) => {
    const path = `book.chapters[${ci}]`;
    if (!isRecord(c)) {
      p.add(path, 'must be an object');
      return null;
    }
    if (!nonEmptyString(c.externalId)) p.add(`${path}.externalId`, 'required');
    else if (chapterIds.has(c.externalId))
      p.add(`${path}.externalId`, `duplicate chapter id "${c.externalId}"`);
    else chapterIds.add(c.externalId);
    if (!nonEmptyString(c.name)) p.add(`${path}.name`, 'required');
    if (!Array.isArray(c.techniques)) {
      p.add(`${path}.techniques`, 'must be an array');
      return null;
    }
    const techniques = (c.techniques as unknown[]).map((t, ti) => {
      const tp = `${path}.techniques[${ti}]`;
      if (!isRecord(t)) {
        p.add(tp, 'must be an object');
        return null;
      }
      if (!nonEmptyString(t.externalId)) p.add(`${tp}.externalId`, 'required');
      else if (techniqueIds.has(t.externalId))
        p.add(`${tp}.externalId`, `duplicate technique id "${t.externalId}"`);
      else techniqueIds.add(t.externalId);
      if (!nonEmptyString(t.name)) p.add(`${tp}.name`, 'required');
      return { externalId: String(t.externalId).trim(), name: String(t.name).trim() };
    });
    return {
      externalId: String(c.externalId).trim(),
      name: String(c.name).trim(),
      techniques: techniques as TechniqueDef[],
    };
  });
  p.throwIfAny('Invalid Book file');

  return {
    schemaVersion: BOOK_SCHEMA_VERSION,
    type: 'book',
    book: {
      externalId: (book.externalId as string).trim(),
      name: (book.name as string).trim(),
      version: book.version as string | undefined,
      description: book.description as string | undefined,
      chapters: chapters as ChapterDef[],
    },
  };
}

/** Upgrade older Book file versions to the current shape. Only v1 exists today. */
function migrateBookFile(raw: Record<string, unknown>): Record<string, unknown> {
  switch (raw.schemaVersion) {
    case 1:
      return raw;
    default:
      throw new ImportError(`Unsupported Book schema version ${raw.schemaVersion}`);
  }
}

// ----------------------------------------------------------------- merge

/**
 * Import or update a Book from a validated Book file.
 *
 * Matching is by `externalId`. Source-controlled fields (names, structure, ordering) are
 * updated; user-controlled fields (progress, notes, links, archive) are always preserved.
 * Techniques dropped by the source are orphaned if they hold user data, otherwise removed.
 * Runs in one transaction; any conflict aborts with nothing written.
 */
export async function importBook(
  file: BookFile,
  db: AppDatabase = defaultDb,
): Promise<BookImportSummary> {
  const def = file.book;
  return db.transaction('rw', [db.books, db.chapters, db.techniques], async () => {
    const existingBooks = await db.books.where('externalId').equals(def.externalId).toArray();
    if (existingBooks.length > 1)
      throw new ImportError(
        `Ambiguous import: ${existingBooks.length} local Books share external id "${def.externalId}"`,
      );
    const ts = now();
    const summary: BookImportSummary = {
      bookId: '',
      bookName: def.name,
      createdBook: false,
      techniquesAdded: 0,
      techniquesUpdated: 0,
      techniquesOrphaned: 0,
      techniquesRemoved: 0,
      chaptersAdded: 0,
      chaptersOrphaned: 0,
      chaptersRemoved: 0,
    };

    let book = existingBooks[0];
    if (!book) {
      const all = await db.books.toArray();
      book = {
        id: newId(),
        externalId: def.externalId,
        sourceType: 'imported',
        sourceVersion: def.version,
        name: def.name,
        description: def.description,
        ordering: all.reduce((m, b) => Math.max(m, b.ordering), -1) + 1,
        hidden: false,
        createdAt: ts,
        updatedAt: ts,
      };
      await db.books.add(book);
      summary.createdBook = true;
    } else {
      const patch: Partial<Book> = {
        name: def.name,
        sourceVersion: def.version,
        sourceType: 'imported',
        updatedAt: ts,
      };
      if (def.description !== undefined) patch.description = def.description;
      await db.books.update(book.id, patch);
    }
    summary.bookId = book.id;

    const existingChapters = await db.chapters.where('bookId').equals(book.id).toArray();
    const existingTechniques = await db.techniques.where('bookId').equals(book.id).toArray();
    const chapterByExt = indexByExternalId(existingChapters, 'chapter');
    const techniqueByExt = indexByExternalId(existingTechniques, 'technique');

    const seenChapterIds = new Set<string>();
    const seenTechniqueIds = new Set<string>();
    let chapterOrdering = 0;

    for (const cdef of def.chapters) {
      let chapter = chapterByExt.get(cdef.externalId);
      if (chapter) {
        await db.chapters.update(chapter.id, {
          name: cdef.name,
          ordering: chapterOrdering,
          sourceStatus: 'present',
        });
      } else {
        chapter = {
          id: newId(),
          externalId: cdef.externalId,
          bookId: book.id,
          name: cdef.name,
          ordering: chapterOrdering,
          sourceStatus: 'present',
        };
        await db.chapters.add(chapter);
        summary.chaptersAdded++;
      }
      seenChapterIds.add(chapter.id);
      chapterOrdering++;

      let techniqueOrdering = 0;
      for (const tdef of cdef.techniques) {
        const existing = techniqueByExt.get(tdef.externalId);
        if (existing) {
          await db.techniques.update(existing.id, {
            name: tdef.name,
            chapterId: chapter.id,
            ordering: techniqueOrdering,
            sourceStatus: 'present',
            updatedAt: ts,
          });
          seenTechniqueIds.add(existing.id);
          summary.techniquesUpdated++;
        } else {
          const technique: Technique = {
            id: newId(),
            externalId: tdef.externalId,
            bookId: book.id,
            chapterId: chapter.id,
            name: tdef.name,
            ...DEFAULT_USER_DATA,
            sourceStatus: 'present',
            ordering: techniqueOrdering,
            createdAt: ts,
            updatedAt: ts,
          };
          await db.techniques.add(technique);
          seenTechniqueIds.add(technique.id);
          summary.techniquesAdded++;
        }
        techniqueOrdering++;
      }
    }

    // Techniques no longer in the source.
    for (const t of existingTechniques) {
      if (seenTechniqueIds.has(t.id) || t.sourceStatus === 'user') continue;
      if (hasUserData(t)) {
        if (t.sourceStatus !== 'orphaned') {
          await db.techniques.update(t.id, { sourceStatus: 'orphaned', updatedAt: ts });
        }
        summary.techniquesOrphaned++;
      } else {
        await db.techniques.delete(t.id);
        summary.techniquesRemoved++;
      }
    }

    // Chapters no longer in the source: keep if anything still lives in them.
    for (const c of existingChapters) {
      if (seenChapterIds.has(c.id) || c.sourceStatus === 'user') continue;
      const remaining = await db.techniques.where('chapterId').equals(c.id).count();
      if (remaining > 0) {
        if (c.sourceStatus !== 'orphaned') {
          await db.chapters.update(c.id, { sourceStatus: 'orphaned', ordering: chapterOrdering++ });
        }
        summary.chaptersOrphaned++;
      } else {
        await db.chapters.delete(c.id);
        summary.chaptersRemoved++;
      }
    }

    return summary;
  });
}

function indexByExternalId<T extends { externalId?: string; sourceStatus: string }>(
  items: T[],
  kind: string,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (!item.externalId || item.sourceStatus === 'user') continue;
    if (map.has(item.externalId))
      throw new ImportError(
        `Ambiguous import: two local ${kind}s share external id "${item.externalId}"`,
      );
    map.set(item.externalId, item);
  }
  return map;
}

// ---------------------------------------------------------------- export

/**
 * Export a Book as a shareable Book file (structure only, no user progress).
 * User-created items get their internal id as external id so re-imports elsewhere are stable.
 */
export async function exportBook(bookId: string, db: AppDatabase = defaultDb): Promise<BookFile> {
  const book = await db.books.get(bookId);
  if (!book) throw new Error('Book not found');
  const chapters = await db.chapters.where('bookId').equals(bookId).sortBy('ordering');
  const techniques = await db.techniques.where('bookId').equals(bookId).toArray();
  const byChapter = new Map<string, Technique[]>();
  for (const t of techniques) {
    if (t.archived) continue;
    const list = byChapter.get(t.chapterId) ?? [];
    list.push(t);
    byChapter.set(t.chapterId, list);
  }
  return {
    schemaVersion: BOOK_SCHEMA_VERSION,
    type: 'book',
    book: {
      externalId: book.externalId ?? book.id,
      name: book.name,
      version: book.sourceVersion,
      description: book.description,
      chapters: chapters.map((c: Chapter) => ({
        externalId: c.externalId ?? c.id,
        name: c.name,
        techniques: (byChapter.get(c.id) ?? [])
          .sort((a, b) => a.ordering - b.ordering)
          .map((t) => ({ externalId: t.externalId ?? t.id, name: t.name })),
      })),
    },
  };
}
