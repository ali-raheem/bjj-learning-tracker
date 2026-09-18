import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  applyFilters,
  applyPreset,
  groupByChapter,
  joinRows,
  PRESETS,
  presetActive,
  PRESET_STAT,
  progressStats,
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

const notedTechniques = [
  tech('flower', 'c1', 'b1', { notesMarkdown: 'outside foot externally rotated' }),
  tech('scissor', 'c1', 'b1', { notesMarkdown: 'grip the sleeve first' }),
];
const notedRows = joinRows(notedTechniques, chapters, books);

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

  it('practised filter means drilled or sparred at least once', () => {
    expect(names(applyFilters(rows, { ...DEFAULT_FILTERS, practised: 'no' }, all))).toEqual([
      'hipbump',
    ]);
    expect(names(applyFilters(rows, { ...DEFAULT_FILTERS, practised: 'yes' }, all))).toEqual([
      'flower',
      'scissor',
      'kneeshield',
      'other',
    ]);
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

describe('search over notes', () => {
  it('matches notes text alongside name/chapter/book', () => {
    expect(
      names(applyFilters(notedRows, { ...DEFAULT_FILTERS, search: 'externally rotated' }, all)),
    ).toEqual(['flower']);
    expect(names(applyFilters(notedRows, { ...DEFAULT_FILTERS, search: 'sleeve' }, all))).toEqual([
      'scissor',
    ]);
    expect(
      names(applyFilters(notedRows, { ...DEFAULT_FILTERS, search: 'nonexistent' }, all)),
    ).toEqual([]);
  });
});

describe('presets', () => {
  it('"Try in rolling" surfaces read+drilled, sparred<3, least sparred first', () => {
    const rolling = PRESETS.find((p) => p.id === 'rolling')!;
    const f = applyPreset(DEFAULT_FILTERS, rolling);
    expect(names(sortRows(applyFilters(rows, f, all), f.sort))).toEqual(['scissor', 'flower']);
  });

  it('"Need to drill" surfaces read but not drilled', () => {
    const drill = PRESETS.find((p) => p.id === 'drill')!;
    const f = applyPreset(DEFAULT_FILTERS, drill);
    expect(names(applyFilters(rows, f, all))).toEqual(['hipbump']);
  });

  it('"To read" surfaces unread techniques with mat experience, most sparred first', () => {
    const toRead = PRESETS.find((p) => p.id === 'read')!;
    const f = applyPreset(DEFAULT_FILTERS, toRead);
    const extra = [
      tech('unreadSparred', 'c1', 'b1', { sparringSuccesses: 2 }),
      tech('unreadDrilled', 'c1', 'b1', { drilled: true }),
      tech('untouched', 'c1', 'b1'),
      tech('readAndDrilled', 'c1', 'b1', { read: true, drilled: true }),
    ];
    const r = joinRows(extra, chapters, books);
    expect(names(sortRows(applyFilters(r, f, all), f.sort))).toEqual([
      'unreadSparred',
      'unreadDrilled',
    ]);
  });

  it('"Established" surfaces sparred = 3', () => {
    const established = PRESETS.find((p) => p.id === 'established')!;
    const f = applyPreset(DEFAULT_FILTERS, established);
    expect(names(applyFilters(rows, f, all))).toEqual(['kneeshield']);
  });

  it('presetActive detects a match regardless of how filters were set, and ignores search/archived', () => {
    const rolling = PRESETS.find((p) => p.id === 'rolling')!;
    const manual = {
      ...DEFAULT_FILTERS,
      read: 'yes' as const,
      drilled: 'yes' as const,
      spar: 'lt3' as const,
      sort: 'sparAsc' as const,
      search: 'guard',
      archived: 'show' as const,
    };
    expect(presetActive(manual, rolling)).toBe(true);
    expect(presetActive(DEFAULT_FILTERS, rolling)).toBe(false);
  });

  it('applyPreset preserves search and archived but resets everything else to default', () => {
    const rolling = PRESETS.find((p) => p.id === 'rolling')!;
    const from = {
      ...DEFAULT_FILTERS,
      search: 'guard',
      archived: 'show' as const,
      sort: 'name' as const,
    };
    const f = applyPreset(from, rolling);
    expect(f.search).toBe('guard');
    expect(f.archived).toBe('show');
    expect(f.sort).toBe('sparAsc');
  });
});

describe('progressStats', () => {
  it('is all zeros for an empty population', () => {
    expect(progressStats([])).toEqual({
      total: 0,
      read: 0,
      drilled: 0,
      spar: 0,
      working: 0,
      overall: 0,
    });
  });

  it('gives partial credit for sparring and full marks only at 3', () => {
    const s = progressStats([
      { read: true, drilled: true, sparringSuccesses: 3 },
      { read: true, drilled: false, sparringSuccesses: 2 },
      { read: false, drilled: false, sparringSuccesses: 0 },
      { read: false, drilled: true, sparringSuccesses: 1 },
    ]);
    expect(s.total).toBe(4);
    expect(s.read).toBe(50);
    expect(s.drilled).toBe(50);
    expect(s.spar).toBe(50); // 6 of 12 possible successes
    expect(s.working).toBe(25);
    expect(s.overall).toBe(50); // 2 + 2 + 6 = 10 of 20 points
  });

  it('is 100% only when everything is read, drilled and sparred three times', () => {
    const done = { read: true, drilled: true, sparringSuccesses: 3 };
    expect(progressStats([done, done]).overall).toBe(100);
    expect(progressStats([done, { ...done, sparringSuccesses: 2 }]).overall).toBe(90);
  });

  it('maps every preset to a stat', () => {
    for (const p of PRESETS) expect(PRESET_STAT[p.id]).toBeDefined();
  });
});
