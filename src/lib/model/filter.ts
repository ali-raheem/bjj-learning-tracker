import { MAX_SPARRING, type Book, type Chapter, type Technique } from './types';

export type TriFilter = 'any' | 'yes' | 'no';
export type SparFilter = 'any' | '0' | '1' | '2' | '3' | 'lt3';
export type ArchivedFilter = 'hide' | 'show' | 'only';
export type SortMode = 'default' | 'name' | 'sparAsc' | 'sparDesc' | 'read' | 'drilled';

export interface Filters {
  search: string;
  read: TriFilter;
  drilled: TriFilter;
  spar: SparFilter;
  /** Drilled or used in sparring at least once: mat experience regardless of study. */
  practised: TriFilter;
  archived: ArchivedFilter;
  sort: SortMode;
}

export const DEFAULT_FILTERS: Filters = {
  search: '',
  read: 'any',
  drilled: 'any',
  spar: 'any',
  practised: 'any',
  archived: 'hide',
  sort: 'default',
};

export function isPractised(t: { drilled: boolean; sparringSuccesses: number }): boolean {
  return t.drilled || t.sparringSuccesses > 0;
}

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
  const hay =
    `${row.technique.name}\n${row.chapter.name}\n${row.book.name}\n${row.technique.notesMarkdown}`.toLowerCase();
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
      matchTri(f.practised, isPractised(r.technique)) &&
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

// ---------------------------------------------------------------- presets

/** One-tap filter shortcuts. They only set filters; nothing is stored on techniques. */
export interface Preset {
  id: string;
  label: string;
  filters: Partial<Pick<Filters, 'read' | 'drilled' | 'spar' | 'practised' | 'sort'>>;
}

const PRESET_KEYS = ['read', 'drilled', 'spar', 'practised', 'sort'] as const;

export const PRESETS: Preset[] = [
  // Ordered along the learning progression: study, practise, apply, and what already works.
  { id: 'read', label: 'Read', filters: { read: 'no', practised: 'yes', sort: 'sparDesc' } },
  { id: 'drill', label: 'Drill', filters: { read: 'yes', drilled: 'no', sort: 'default' } },
  {
    id: 'rolling',
    label: 'Spar',
    filters: { read: 'yes', drilled: 'yes', spar: 'lt3', sort: 'sparAsc' },
  },
  { id: 'established', label: 'Works', filters: { spar: '3', sort: 'default' } },
];

/** Filters with the preset applied. Search and the archived setting are left as they are. */
export function applyPreset(current: Filters, preset: Preset): Filters {
  return {
    ...DEFAULT_FILTERS,
    search: current.search,
    archived: current.archived,
    ...preset.filters,
  };
}

/** True when the current filters are exactly what this preset would produce. */
export function presetActive(current: Filters, preset: Preset): boolean {
  const target = applyPreset(current, preset);
  return PRESET_KEYS.every((k) => current[k] === target[k]);
}

// --------------------------------------------------------------- progress

/** Completion over a population of techniques (normally non-archived, active Books only). */
export interface ProgressStats {
  total: number;
  /** Percent of techniques marked read. */
  read: number;
  /** Percent marked drilled. */
  drilled: number;
  /** Percent of possible sparring successes achieved: partial credit, 2 of 3 counts as 67%. */
  spar: number;
  /** Percent with all three sparring successes. */
  working: number;
  /** Overall: read, drilled and each sparring success count one point, five per technique. */
  overall: number;
}

const pct = (num: number, den: number) => (den === 0 ? 0 : Math.round((100 * num) / den));

export function progressStats(
  techniques: Pick<Technique, 'read' | 'drilled' | 'sparringSuccesses'>[],
): ProgressStats {
  const total = techniques.length;
  let read = 0;
  let drilled = 0;
  let sparPoints = 0;
  let working = 0;
  for (const t of techniques) {
    if (t.read) read++;
    if (t.drilled) drilled++;
    const s = Math.max(0, Math.min(MAX_SPARRING, t.sparringSuccesses));
    sparPoints += s;
    if (s >= MAX_SPARRING) working++;
  }
  return {
    total,
    read: pct(read, total),
    drilled: pct(drilled, total),
    spar: pct(sparPoints, total * MAX_SPARRING),
    working: pct(working, total),
    overall: pct(read + drilled + sparPoints, total * (2 + MAX_SPARRING)),
  };
}

/** Which stat fills each preset chip. */
export const PRESET_STAT: Record<string, keyof Omit<ProgressStats, 'total' | 'overall'>> = {
  read: 'read',
  drill: 'drilled',
  rolling: 'spar',
  established: 'working',
};
