import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  applyFilters,
  groupByChapter,
  joinRows,
  sortRows,
  type TechniqueRow,
} from '../src/lib/model/filter';
import { DEFAULT_USER_DATA, type Book, type Chapter, type Technique } from '../src/lib/model/types';

const book = (id: string, ordering: number): Book => ({
  id,
  name: `Book ${id}`,
  sourceType: 'user',
  ordering,
  hidden: false,
  createdAt: '',
  updatedAt: '',
});
const chapter = (id: string, bookId: string, ordering: number): Chapter => ({
  id,
  bookId,
  name: `Chapter ${id}`,
  ordering,
  sourceStatus: 'user',
});
const tech = (
  id: string,
  chapterId: string,
  bookId: string,
  over: Partial<Technique> = {},
): Technique => ({
  id,
  bookId,
  chapterId,
  name: id,
  ...DEFAULT_USER_DATA,
  sourceStatus: 'user',
  ordering: 0,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const books = [book('b1', 0), book('b2', 1)];
const chapters = [chapter('c1', 'b1', 0), chapter('c2', 'b1', 1), chapter('c3', 'b2', 0)];
const techniques = [
  tech('flower', 'c1', 'b1', { read: true, drilled: true, sparringSuccesses: 2, ordering: 0 }),
  tech('scissor', 'c1', 'b1', { read: true, drilled: true, sparringSuccesses: 0, ordering: 1 }),
  tech('hipbump', 'c1', 'b1', { read: true, ordering: 2 }),
  tech('kneeshield', 'c2', 'b1', { read: true, drilled: true, sparringSuccesses: 3 }),
  tech('archived', 'c2', 'b1', { archived: true, read: true }),
  tech('other', 'c3', 'b2', { drilled: true }),
  tech('dangling', 'nope', 'b2'),
];
const rows = joinRows(techniques, chapters, books);
const all = new Set(['b1', 'b2']);
const names = (r: TechniqueRow[]) => r.map((x) => x.technique.id);

describe('filters', () => {
  it('joins and drops dangling references', () => {
    expect(rows).toHaveLength(6);
  });

  it('hides archived by default and respects active books', () => {
    expect(names(applyFilters(rows, DEFAULT_FILTERS, all))).not.toContain('archived');
    expect(names(applyFilters(rows, DEFAULT_FILTERS, new Set(['b2'])))).toEqual(['other']);
    expect(names(applyFilters(rows, { ...DEFAULT_FILTERS, archived: 'only' }, all))).toEqual([
      'archived',
    ]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, archived: 'show' }, all)).toHaveLength(6);
  });

  it('combines read, drilled and sparring filters (the "try in rolling" view)', () => {
    const f = {
      ...DEFAULT_FILTERS,
      read: 'yes' as const,
      drilled: 'yes' as const,
      spar: 'lt3' as const,
    };
    expect(names(applyFilters(rows, f, all))).toEqual(['flower', 'scissor']);
    expect(
      names(applyFilters(rows, { ...DEFAULT_FILTERS, read: 'yes', drilled: 'no' }, all)),
    ).toEqual(['hipbump']);
    expect(names(applyFilters(rows, { ...DEFAULT_FILTERS, spar: '3' }, all))).toEqual([
      'kneeshield',
    ]);
  });

  it('searches technique, chapter and book names with all terms', () => {
    expect(names(applyFilters(rows, { ...DEFAULT_FILTERS, search: 'FLOW' }, all))).toEqual([
      'flower',
    ]);
    expect(names(applyFilters(rows, { ...DEFAULT_FILTERS, search: 'chapter c3' }, all))).toEqual([
      'other',
    ]);
    expect(names(applyFilters(rows, { ...DEFAULT_FILTERS, search: 'book b2' }, all))).toEqual([
      'other',
    ]);
    expect(
      names(applyFilters(rows, { ...DEFAULT_FILTERS, search: 'book b2 flower' }, all)),
    ).toEqual([]);
  });

  it('sorts by sparring ascending with default tiebreak', () => {
    const visible = applyFilters(rows, DEFAULT_FILTERS, all);
    expect(names(sortRows(visible, 'sparAsc'))).toEqual([
      'scissor',
      'hipbump',
      'other',
      'flower',
      'kneeshield',
    ]);
    expect(names(sortRows(visible, 'sparDesc'))).toEqual([
      'kneeshield',
      'flower',
      'scissor',
      'hipbump',
      'other',
    ]);
    expect(names(sortRows(visible, 'name'))).toEqual([
      'flower',
      'hipbump',
      'kneeshield',
      'other',
      'scissor',
    ]);
    expect(names(sortRows(visible, 'drilled')).slice(-1)).toEqual(['hipbump']);
  });

  it('groups by chapter in first-appearance order', () => {
    const g = groupByChapter(sortRows(applyFilters(rows, DEFAULT_FILTERS, all), 'sparAsc'));
    expect(g.map((x) => x.chapter.id)).toEqual(['c1', 'c3', 'c2']);
    expect(g[0]!.rows.map((r) => r.technique.id)).toEqual(['scissor', 'hipbump', 'flower']);
  });
});
