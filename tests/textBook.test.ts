import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAnyBookFile } from '../src/lib/import/anyBook';
import { validateBookFile } from '../src/lib/import/bookImport';
import { ImportError } from '../src/lib/import/validation';
import { parseTextBook, slugify, TextBookError } from '../src/lib/import/textBook.js';

const sample = `
book: Jiu-Jitsu University
id: jju
version: 1.0
description: Index

# White · Mount survival
Basic posture
Hip escape | hip-escape-mount
// a comment

# Blue · Mount escapes | blue-mount-escapes
Hip escape | hip-escape-blue
Bridge & roll
`;

describe('slugify', () => {
  it('makes stable ids from names', () => {
    expect(slugify('Flower / Pendulum Sweep')).toBe('flower-pendulum-sweep');
    expect(slugify('  Bridge & roll ')).toBe('bridge-and-roll');
    expect(slugify('White · Mount survival')).toBe('white-mount-survival');
    expect(slugify('Écrasé!')).toBe('ecrase');
  });
});

describe('parseTextBook', () => {
  it('parses headers, chapters, techniques, pinned ids and comments', () => {
    const f = parseTextBook(sample);
    expect(f.book).toMatchObject({
      externalId: 'jju',
      name: 'Jiu-Jitsu University',
      version: '1.0',
      description: 'Index',
    });
    expect(f.book.chapters.map((c) => c.externalId)).toEqual([
      'white-mount-survival',
      'blue-mount-escapes',
    ]);
    expect(f.book.chapters[0]!.techniques).toEqual([
      { externalId: 'basic-posture', name: 'Basic posture' },
      { externalId: 'hip-escape-mount', name: 'Hip escape' },
    ]);
    expect(f.book.chapters[1]!.techniques[1]).toEqual({
      externalId: 'bridge-and-roll',
      name: 'Bridge & roll',
    });
  });

  it('passes the JSON validator', () => {
    expect(() => validateBookFile(parseTextBook(sample))).not.toThrow();
  });

  it('falls back to the file name for the book name and id', () => {
    const f = parseTextBook('# A\nX', { fallbackName: 'My Gym' });
    expect(f.book.name).toBe('My Gym');
    expect(f.book.externalId).toBe('my-gym');
  });

  it('reports every problem with line numbers', () => {
    const bad = `book: B
stray line
# Ch
Hip escape
Hip escape
# Ch
|
`;
    try {
      parseTextBook(bad);
      expect.fail('should throw');
    } catch (e) {
      const err = e as TextBookError;
      const all = err.problems.join('\n');
      expect(all).toMatch(/line 2: "stray line" appears before the first chapter/);
      expect(all).toMatch(/line 5: "Hip escape" has the same id "hip-escape" as line 4/);
      expect(all).toMatch(/line 6: chapter id "ch" already used on line 3/);
      expect(all).toMatch(/line 7: technique has no name/);
    }
  });

  it('requires a name and at least one chapter', () => {
    expect(() => parseTextBook('')).toThrow(/missing "book: Name" header/);
    expect(() => parseTextBook('book: X')).toThrow(/no chapters/);
  });

  it('accepts the starter file in books/', () => {
    const f = parseTextBook(readFileSync('books/jju.txt', 'utf8'));
    expect(f.book.externalId).toBe('jju');
    expect(f.book.chapters).toHaveLength(5);
    expect(() => validateBookFile(f)).not.toThrow();
  });
});

describe('parseAnyBookFile', () => {
  it('detects JSON vs text by content', () => {
    const fromText = parseAnyBookFile(sample, 'jju.txt');
    const fromJson = parseAnyBookFile(JSON.stringify(fromText), 'jju.json');
    expect(fromJson).toEqual(fromText);
  });

  it('wraps text errors as ImportError for the UI', () => {
    expect(() => parseAnyBookFile('book: X\n', 'x.txt')).toThrow(ImportError);
    expect(() => parseAnyBookFile('book: X\n', 'x.txt')).toThrow(/no chapters/);
  });
});
