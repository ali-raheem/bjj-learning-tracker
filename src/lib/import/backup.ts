import { db as defaultDb, type AppDatabase } from '../db/db';
import { clampSparring, type Book, type Chapter, type Technique } from '../model/types';
import { ImportError, Problems, isRecord, parseJson } from './validation';

export const BACKUP_SCHEMA_VERSION = 1;
export const APP_ID = 'jju-companion';

export interface BackupFile {
  schemaVersion: number;
  type: 'backup';
  app: string;
  exportedAt: string;
  books: Book[];
  chapters: Chapter[];
  techniques: Technique[];
}

export type RestoreMode = 'replace' | 'merge';

export interface RestoreSummary {
  mode: RestoreMode;
  books: number;
  chapters: number;
  techniques: number;
}

export async function exportBackup(db: AppDatabase = defaultDb): Promise<BackupFile> {
  return db.transaction('r', [db.books, db.chapters, db.techniques], async () => ({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    type: 'backup',
    app: APP_ID,
    exportedAt: new Date().toISOString(),
    books: await db.books.orderBy('ordering').toArray(),
    chapters: await db.chapters.toArray(),
    techniques: await db.techniques.toArray(),
  }));
}

export function backupFilename(date: Date = new Date()): string {
  return `bjj-tracker-backup-${date.toISOString().slice(0, 10)}.json`;
}

// ------------------------------------------------------------ validation

export function parseBackupFile(text: string): BackupFile {
  return validateBackupFile(parseJson(text));
}

const SOURCE_TYPES = new Set(['user', 'imported']);
const SOURCE_STATUSES = new Set(['user', 'present', 'orphaned']);

export function validateBackupFile(raw: unknown): BackupFile {
  const p = new Problems();
  if (!isRecord(raw)) throw new ImportError('Backup must be a JSON object');
  if (raw.type !== 'backup') p.add('type', `expected "backup", got ${JSON.stringify(raw.type)}`);
  if (typeof raw.schemaVersion !== 'number') p.add('schemaVersion', 'missing or not a number');
  else if (raw.schemaVersion > BACKUP_SCHEMA_VERSION)
    p.add('schemaVersion', `version ${raw.schemaVersion} is newer than this app supports`);
  p.throwIfAny('Not a backup file');

  const data = migrateBackup(raw);
  for (const key of ['books', 'chapters', 'techniques'])
    if (!Array.isArray(data[key])) p.add(key, 'must be an array');
  p.throwIfAny('Invalid backup file');

  const bookIds = new Set<string>();
  const books: Book[] = (data.books as unknown[]).map((b, i) => {
    const path = `books[${i}]`;
    if (!isRecord(b)) {
      p.add(path, 'must be an object');
      return null as unknown as Book;
    }
    checkId(p, path, b.id, bookIds);
    checkString(p, `${path}.name`, b.name);
    if (!SOURCE_TYPES.has(String(b.sourceType))) p.add(`${path}.sourceType`, 'invalid');
    return {
      id: String(b.id),
      externalId: optString(b.externalId),
      sourceType: b.sourceType as Book['sourceType'],
      sourceVersion: optString(b.sourceVersion),
      name: String(b.name),
      description: optString(b.description),
      ordering: numberOr(b.ordering, i),
      hidden: b.hidden === true,
      createdAt: optString(b.createdAt) ?? new Date().toISOString(),
      updatedAt: optString(b.updatedAt) ?? new Date().toISOString(),
    };
  });

  const chapterIds = new Set<string>();
  const chapters: Chapter[] = (data.chapters as unknown[]).map((c, i) => {
    const path = `chapters[${i}]`;
    if (!isRecord(c)) {
      p.add(path, 'must be an object');
      return null as unknown as Chapter;
    }
    checkId(p, path, c.id, chapterIds);
    checkString(p, `${path}.name`, c.name);
    if (typeof c.bookId !== 'string' || !bookIds.has(c.bookId))
      p.add(`${path}.bookId`, 'does not reference a Book in this backup');
    return {
      id: String(c.id),
      externalId: optString(c.externalId),
      bookId: String(c.bookId),
      name: String(c.name),
      ordering: numberOr(c.ordering, i),
      sourceStatus: SOURCE_STATUSES.has(String(c.sourceStatus))
        ? (c.sourceStatus as Chapter['sourceStatus'])
        : c.externalId
          ? 'present'
          : 'user',
    };
  });

  const chapterBook = new Map(chapters.filter(Boolean).map((c) => [c.id, c.bookId]));
  const techniqueIds = new Set<string>();
  const techniques: Technique[] = (data.techniques as unknown[]).map((t, i) => {
    const path = `techniques[${i}]`;
    if (!isRecord(t)) {
      p.add(path, 'must be an object');
      return null as unknown as Technique;
    }
    checkId(p, path, t.id, techniqueIds);
    checkString(p, `${path}.name`, t.name);
    if (typeof t.chapterId !== 'string' || !chapterBook.has(t.chapterId))
      p.add(`${path}.chapterId`, 'does not reference a Chapter in this backup');
    const links = Array.isArray(t.links) ? t.links : [];
    links.forEach((l, li) => {
      if (!isRecord(l) || typeof l.url !== 'string' || !l.url.trim())
        p.add(`${path}.links[${li}]`, 'must have a url');
    });
    return {
      id: String(t.id),
      externalId: optString(t.externalId),
      bookId: chapterBook.get(String(t.chapterId)) ?? String(t.bookId),
      chapterId: String(t.chapterId),
      name: String(t.name),
      read: t.read === true,
      drilled: t.drilled === true,
      sparringSuccesses: clampSparring(Number(t.sparringSuccesses ?? 0)),
      notesMarkdown: typeof t.notesMarkdown === 'string' ? t.notesMarkdown : '',
      links: (links as Record<string, unknown>[]).map((l, li) => ({
        id: optString(l.id) ?? `${t.id}-link-${li}`,
        url: String(l.url),
        ...(optString(l.title) ? { title: String(l.title) } : {}),
      })),
      archived: t.archived === true,
      sourceStatus: SOURCE_STATUSES.has(String(t.sourceStatus))
        ? (t.sourceStatus as Technique['sourceStatus'])
        : t.externalId
          ? 'present'
          : 'user',
      ordering: numberOr(t.ordering, i),
      createdAt: optString(t.createdAt) ?? new Date().toISOString(),
      updatedAt: optString(t.updatedAt) ?? new Date().toISOString(),
    };
  });
  p.throwIfAny('Invalid backup file');

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    type: 'backup',
    app: typeof data.app === 'string' ? data.app : APP_ID,
    exportedAt: optString(data.exportedAt) ?? '',
    books,
    chapters,
    techniques,
  };
}

/** Upgrade older backup versions to the current shape. Only v1 exists today. */
function migrateBackup(raw: Record<string, unknown>): Record<string, unknown> {
  switch (raw.schemaVersion) {
    case 1:
      return raw;
    default:
      throw new ImportError(`Unsupported backup schema version ${raw.schemaVersion}`);
  }
}

function checkId(p: Problems, path: string, id: unknown, seen: Set<string>) {
  if (typeof id !== 'string' || !id.trim()) p.add(`${path}.id`, 'required');
  else if (seen.has(id)) p.add(`${path}.id`, `duplicate id "${id}"`);
  else seen.add(id);
}
function checkString(p: Problems, path: string, v: unknown) {
  if (typeof v !== 'string' || !v.trim()) p.add(path, 'required');
}
function optString(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}
function numberOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

// --------------------------------------------------------------- restore

/**
 * Restore a validated backup.
 * - `replace`: wipes the local database first.
 * - `merge`: records with the same id overwrite local ones; everything else is kept.
 */
export async function restoreBackup(
  file: BackupFile,
  mode: RestoreMode,
  db: AppDatabase = defaultDb,
): Promise<RestoreSummary> {
  await db.transaction('rw', [db.books, db.chapters, db.techniques], async () => {
    if (mode === 'replace') {
      await db.techniques.clear();
      await db.chapters.clear();
      await db.books.clear();
    }
    await db.books.bulkPut(file.books);
    await db.chapters.bulkPut(file.chapters);
    await db.techniques.bulkPut(file.techniques);
  });
  return {
    mode,
    books: file.books.length,
    chapters: file.chapters.length,
    techniques: file.techniques.length,
  };
}
