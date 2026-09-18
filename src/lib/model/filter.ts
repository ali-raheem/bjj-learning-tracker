import type { Book, Chapter, Technique } from './types';

export type TriFilter = 'any' | 'yes' | 'no';
export type SparFilter = 'any' | '0' | '1' | '2' | '3' | 'lt3';
export type ArchivedFilter = 'hide' | 'show' | 'only';
export type SortMode = 'default' | 'name' | 'sparAsc' | 'sparDesc' | 'read' | 'drilled';

export interface Filters {
  search: string;
  read: TriFilter;
  drilled: TriFilter;
  spar: SparFilter;
  archived: ArchivedFilter;
  sort: SortMode;
}

export const DEFAULT_FILTERS: Filters = {
  search: '',
  read: 'any',
  drilled: 'any',
  spar: 'any',
  archived: 'hide',
  sort: 'default',
};

export function isDefaultFilters(f: Filters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).every(
    (k) => f[k] === DEFAULT_FILTERS[k],
  );
}

export interface TechniqueRow {
  technique: Technique;
  chapter: Chapter;
  book: Book;
}

export interface ChapterGroup {
  book: Book;
  chapter: Chapter;
  rows: TechniqueRow[];
}

function matchTri(f: TriFilter, v: boolean): boolean {
  return f === 'any' || (f === 'yes') === v;
}

function matchSpar(f: SparFilter, n: number): boolean {
  if (f === 'any') return true;
  if (f === 'lt3') return n < 3;
  return n === Number(f);
}

function matchArchived(f: ArchivedFilter, archived: boolean): boolean {
  if (f === 'show') return true;
  return (f === 'only') === archived;
}

function matchSearch(q: string, row: TechniqueRow): boolean {
  if (!q) return true;
  const hay = `${row.technique.name}\n${row.chapter.name}\n${row.book.name}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

/** Join techniques to their chapter and book, dropping any with dangling references. */
export function joinRows(
  techniques: Technique[],
  chapters: Chapter[],
  books: Book[],
): TechniqueRow[] {
  const chapterById = new Map(chapters.map((c) => [c.id, c]));
  const bookById = new Map(books.map((b) => [b.id, b]));
  const rows: TechniqueRow[] = [];
  for (const technique of techniques) {
    const chapter = chapterById.get(technique.chapterId);
    const book = chapter && bookById.get(chapter.bookId);
    if (chapter && book) rows.push({ technique, chapter, book });
  }
  return rows;
}

export function applyFilters(rows: TechniqueRow[], f: Filters, activeBookIds: Set<string>) {
  const q = f.search.trim();
  return rows.filter(
    (r) =>
      activeBookIds.has(r.book.id) &&
      matchArchived(f.archived, r.technique.archived) &&
      matchTri(f.read, r.technique.read) &&
      matchTri(f.drilled, r.technique.drilled) &&
      matchSpar(f.spar, r.technique.sparringSuccesses) &&
      matchSearch(q, r),
  );
}

const defaultCompare = (a: TechniqueRow, b: TechniqueRow) =>
  a.book.ordering - b.book.ordering ||
  a.chapter.ordering - b.chapter.ordering ||
  a.technique.ordering - b.technique.ordering ||
  a.technique.name.localeCompare(b.technique.name);

export function sortRows(rows: TechniqueRow[], sort: SortMode): TechniqueRow[] {
  const out = [...rows];
  switch (sort) {
    case 'name':
      out.sort((a, b) => a.technique.name.localeCompare(b.technique.name) || defaultCompare(a, b));
      break;
    case 'sparAsc':
      out.sort(
        (a, b) =>
          a.technique.sparringSuccesses - b.technique.sparringSuccesses || defaultCompare(a, b),
      );
      break;
    case 'sparDesc':
      out.sort(
        (a, b) =>
          b.technique.sparringSuccesses - a.technique.sparringSuccesses || defaultCompare(a, b),
      );
      break;
    case 'read':
      out.sort(
        (a, b) => Number(b.technique.read) - Number(a.technique.read) || defaultCompare(a, b),
      );
      break;
    case 'drilled':
      out.sort(
        (a, b) => Number(b.technique.drilled) - Number(a.technique.drilled) || defaultCompare(a, b),
      );
      break;
    default:
      out.sort(defaultCompare);
  }
  return out;
}

/**
 * Group sorted rows by chapter, keeping the first-appearance order of chapters so that
 * non-default sorts still read top-to-bottom as the user expects.
 */
export function groupByChapter(rows: TechniqueRow[]): ChapterGroup[] {
  const groups: ChapterGroup[] = [];
  const byChapter = new Map<string, ChapterGroup>();
  for (const row of rows) {
    let g = byChapter.get(row.chapter.id);
    if (!g) {
      g = { book: row.book, chapter: row.chapter, rows: [] };
      byChapter.set(row.chapter.id, g);
      groups.push(g);
    }
    g.rows.push(row);
  }
  return groups;
}
