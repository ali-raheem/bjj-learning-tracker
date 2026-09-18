import { describe, expect, it } from 'vitest';
import { exportBook, importBook, parseBookFile } from '../src/lib/import/bookImport';
import { ImportError } from '../src/lib/import/validation';
import { freshDb, jjuV1, jjuV1_1 } from './helpers';

describe('parseBookFile', () => {
  it('accepts a valid file and trims names', () => {
    const f = parseBookFile(JSON.stringify(jjuV1()));
    expect(f.book.chapters).toHaveLength(2);
    expect(f.book.chapters[0]?.techniques[0]?.name).toBe('Flower Sweep');
  });

  it('rejects invalid JSON', () => {
    expect(() => parseBookFile('{nope')).toThrow(ImportError);
  });

  it('rejects wrong type and missing schemaVersion', () => {
    expect(() => parseBookFile(JSON.stringify({ type: 'backup' }))).toThrow(/Not a Book file/);
  });

  it('lists every problem, including duplicate ids', () => {
    const raw = jjuV1();
    raw.book.chapters[1]!.techniques.push({ externalId: 'flower-sweep', name: '' });
    raw.book.chapters.push({ externalId: 'closed-guard', name: 'Dup', techniques: [] });
    try {
      parseBookFile(JSON.stringify(raw));
      expect.fail('should throw');
    } catch (e) {
      const err = e as ImportError;
      expect(err.problems.join('\n')).toMatch(/duplicate technique id "flower-sweep"/);
      expect(err.problems.join('\n')).toMatch(/duplicate chapter id "closed-guard"/);
      expect(err.problems.join('\n')).toMatch(/techniques\[1\]\.name: required/);
    }
  });

  it('rejects newer schema versions', () => {
    expect(() => parseBookFile(JSON.stringify({ ...jjuV1(), schemaVersion: 99 }))).toThrow(/newer/);
  });
});

describe('importBook', () => {
  it('creates a new book with structure and default progress', async () => {
    const { db } = freshDb();
    const s = await importBook(jjuV1(), db);
    expect(s.createdBook).toBe(true);
    expect(s.techniquesAdded).toBe(4);
    expect(await db.books.count()).toBe(1);
    expect(await db.chapters.count()).toBe(2);
    const ts = await db.techniques.toArray();
    expect(ts).toHaveLength(4);
    expect(ts.every((t) => t.sourceStatus === 'present' && !t.read && t.links.length === 0)).toBe(
      true,
    );
    const book = (await db.books.toArray())[0]!;
    expect(book.sourceType).toBe('imported');
    expect(book.sourceVersion).toBe('1.0');
  });

  it('is idempotent', async () => {
    const { db } = freshDb();
    await importBook(jjuV1(), db);
    const s = await importBook(jjuV1(), db);
    expect(s.createdBook).toBe(false);
    expect(s.techniquesAdded).toBe(0);
    expect(s.techniquesUpdated).toBe(4);
    expect(await db.techniques.count()).toBe(4);
    expect(await db.chapters.count()).toBe(2);
  });

  it('preserves user data across renames, moves and removals', async () => {
    const { db, repo } = freshDb();
    await importBook(jjuV1(), db);
    const flower = await db.techniques.where('externalId').equals('flower-sweep').first();
    const scissor = await db.techniques.where('externalId').equals('scissor-sweep').first();
    const hipBump = await db.techniques.where('externalId').equals('hip-bump').first();
    const kneeShield = await db.techniques.where('externalId').equals('knee-shield').first();
    await repo.updateTechnique(flower!.id, {
      read: true,
      drilled: true,
      sparringSuccesses: 2,
      notesMarkdown: 'outside foot',
    });
    await repo.addLink(flower!.id, { url: 'https://youtube.com/x', title: 'yt' });
    await repo.setSparring(scissor!.id, 1);
    await repo.setArchived(kneeShield!.id, true);

    const s = await importBook(jjuV1_1(), db);
    expect(s.createdBook).toBe(false);
    expect(s.techniquesAdded).toBe(1);
    expect(s.techniquesUpdated).toBe(2);
    expect(s.techniquesOrphaned).toBe(1); // knee-shield (archived => has user data)
    expect(s.techniquesRemoved).toBe(1); // hip-bump had no user data
    expect(s.chaptersAdded).toBe(1);
    expect(s.chaptersOrphaned).toBe(1); // half-guard still holds knee-shield

    const book = (await db.books.toArray())[0]!;
    expect(book.name).toBe('Jiu-Jitsu University (2nd ed.)');
    expect(book.sourceVersion).toBe('1.1');

    const flower2 = await db.techniques.get(flower!.id);
    expect(flower2!.name).toBe('Flower / Pendulum Sweep');
    expect(flower2!.read).toBe(true);
    expect(flower2!.drilled).toBe(true);
    expect(flower2!.sparringSuccesses).toBe(2);
    expect(flower2!.notesMarkdown).toBe('outside foot');
    expect(flower2!.links).toHaveLength(1);
    expect(flower2!.sourceStatus).toBe('present');

    const scissor2 = await db.techniques.get(scissor!.id);
    const sweeps = await db.chapters.where('externalId').equals('sweeps').first();
    expect(scissor2!.chapterId).toBe(sweeps!.id);
    expect(scissor2!.sparringSuccesses).toBe(1);

    expect(await db.techniques.get(hipBump!.id)).toBeUndefined();

    const knee2 = await db.techniques.get(kneeShield!.id);
    expect(knee2!.sourceStatus).toBe('orphaned');
    expect(knee2!.archived).toBe(true);
    const half = await db.chapters.where('externalId').equals('half-guard').first();
    expect(half!.sourceStatus).toBe('orphaned');

    const closed = await db.chapters.where('externalId').equals('closed-guard').first();
    expect(closed!.name).toBe('Closed Guard Fundamentals');
  });

  it('un-orphans a technique that returns to the source', async () => {
    const { db, repo } = freshDb();
    await importBook(jjuV1(), db);
    const knee = await db.techniques.where('externalId').equals('knee-shield').first();
    await repo.setRead(knee!.id, true);
    await importBook(jjuV1_1(), db);
    expect((await db.techniques.get(knee!.id))!.sourceStatus).toBe('orphaned');
    await importBook(jjuV1(), db);
    const back = await db.techniques.get(knee!.id);
    expect(back!.sourceStatus).toBe('present');
    expect(back!.read).toBe(true);
    expect((await db.chapters.where('externalId').equals('half-guard').first())!.sourceStatus).toBe(
      'present',
    );
  });

  it('leaves user-created chapters and techniques inside an imported book alone', async () => {
    const { db, repo } = freshDb();
    await importBook(jjuV1(), db);
    const book = (await db.books.toArray())[0]!;
    const closed = await db.chapters.where('externalId').equals('closed-guard').first();
    const mine = await repo.createTechnique(closed!.id, { name: 'My Own Sweep' });
    const myChapter = await repo.createChapter(book.id, 'My Chapter');
    await repo.createTechnique(myChapter.id, { name: 'Another' });
    await importBook(jjuV1_1(), db);
    expect((await db.techniques.get(mine.id))!.sourceStatus).toBe('user');
    expect(await db.chapters.get(myChapter.id)).toBeDefined();
    expect(await db.techniques.where('chapterId').equals(myChapter.id).count()).toBe(1);
  });

  it('aborts on ambiguous local state without writing', async () => {
    const { db } = freshDb();
    await importBook(jjuV1(), db);
    const t = (await db.techniques.toArray())[0]!;
    await db.techniques.add({ ...t, id: 'dupe' });
    await expect(importBook(jjuV1_1(), db)).rejects.toThrow(/Ambiguous/);
    const book = (await db.books.toArray())[0]!;
    expect(book.sourceVersion).toBe('1.0');
    expect(await db.techniques.count()).toBe(5);
  });
});

describe('exportBook', () => {
  it('round-trips an imported book', async () => {
    const { db } = freshDb();
    await importBook(jjuV1(), db);
    const book = (await db.books.toArray())[0]!;
    const out = await exportBook(book.id, db);
    expect(out.book.externalId).toBe('jju');
    expect(out.book.chapters.map((c) => c.externalId)).toEqual(['closed-guard', 'half-guard']);
    expect(out.book.chapters[0]!.techniques.map((t) => t.externalId)).toEqual([
      'flower-sweep',
      'scissor-sweep',
      'hip-bump',
    ]);
  });

  it('uses internal ids for user-created content', async () => {
    const { db, repo } = freshDb();
    const b = await repo.createBook({ name: 'Mine' });
    const c = await repo.createChapter(b.id, 'Ch');
    const t = await repo.createTechnique(c.id, { name: 'T' });
    const out = await exportBook(b.id, db);
    expect(out.book.externalId).toBe(b.id);
    expect(out.book.chapters[0]!.techniques[0]!.externalId).toBe(t.id);
  });
});
