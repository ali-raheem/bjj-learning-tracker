import { describe, expect, it } from 'vitest';
import { importBook } from '../src/lib/import/bookImport';
import { freshDb, jjuV1 } from './helpers';

describe('Repo', () => {
  it('deleting a book cascades without touching other books', async () => {
    const { db, repo } = freshDb();
    await importBook(jjuV1(), db);
    const mine = await repo.createBook({ name: 'Mine' });
    const ch = await repo.createChapter(mine.id, 'Ch');
    await repo.createTechnique(ch.id, { name: 'T' });
    await repo.deleteBook(mine.id);
    expect(await db.books.count()).toBe(1);
    expect(await db.chapters.count()).toBe(2);
    expect(await db.techniques.count()).toBe(4);
  });

  it('clamps sparring successes to 0..3 and never below 0', async () => {
    const { db, repo } = freshDb();
    const b = await repo.createBook({ name: 'B' });
    const c = await repo.createChapter(b.id, 'C');
    const t = await repo.createTechnique(c.id, { name: 'T' });
    await repo.setSparring(t.id, 9);
    expect((await db.techniques.get(t.id))!.sparringSuccesses).toBe(3);
    await repo.setSparring(t.id, -2);
    expect((await db.techniques.get(t.id))!.sparringSuccesses).toBe(0);
  });

  it('rejects blank names', async () => {
    const { repo } = freshDb();
    await expect(repo.createBook({ name: '  ' })).rejects.toThrow(/required/);
  });

  it('moving within a book keeps source linkage; moving across books detaches it', async () => {
    const { db, repo } = freshDb();
    await importBook(jjuV1(), db);
    const flower = (await db.techniques.where('externalId').equals('flower-sweep').first())!;
    const half = (await db.chapters.where('externalId').equals('half-guard').first())!;
    await repo.moveTechnique(flower.id, half.id);
    let moved = (await db.techniques.get(flower.id))!;
    expect(moved.chapterId).toBe(half.id);
    expect(moved.externalId).toBe('flower-sweep');
    expect(moved.sourceStatus).toBe('present');

    const other = await repo.createBook({ name: 'Other' });
    const otherCh = await repo.createChapter(other.id, 'X');
    await repo.moveTechnique(flower.id, otherCh.id);
    moved = (await db.techniques.get(flower.id))!;
    expect(moved.bookId).toBe(other.id);
    expect(moved.externalId).toBeUndefined();
    expect(moved.sourceStatus).toBe('user');
    // A re-import now recreates flower-sweep in JJU rather than stealing the moved one.
    await importBook(jjuV1(), db);
    expect(await db.techniques.where('externalId').equals('flower-sweep').count()).toBe(1);
    expect(await db.techniques.count()).toBe(5);
  });

  it('reorders books, chapters and techniques', async () => {
    const { db, repo } = freshDb();
    const a = await repo.createBook({ name: 'A' });
    const b = await repo.createBook({ name: 'B' });
    await repo.reorderBooks([b.id, a.id]);
    expect((await db.books.orderBy('ordering').toArray()).map((x) => x.name)).toEqual(['B', 'A']);
    const c1 = await repo.createChapter(a.id, 'c1');
    const c2 = await repo.createChapter(a.id, 'c2');
    await repo.reorderChapters(a.id, [c2.id]);
    expect(
      (await db.chapters.where('bookId').equals(a.id).sortBy('ordering')).map((x) => x.name),
    ).toEqual(['c2', 'c1']);
    const t1 = await repo.createTechnique(c1.id, { name: 't1' });
    const t2 = await repo.createTechnique(c1.id, { name: 't2' });
    await repo.reorderTechniques(c1.id, [t2.id, t1.id]);
    expect(
      (await db.techniques.where('chapterId').equals(c1.id).sortBy('ordering')).map((x) => x.name),
    ).toEqual(['t2', 't1']);
  });

  it('manages links', async () => {
    const { db, repo } = freshDb();
    const b = await repo.createBook({ name: 'B' });
    const c = await repo.createChapter(b.id, 'C');
    const t = await repo.createTechnique(c.id, { name: 'T' });
    await repo.addLink(t.id, { url: ' https://a ', title: '' });
    await repo.addLink(t.id, { url: 'https://b', title: 'Bee' });
    let links = (await db.techniques.get(t.id))!.links;
    expect(links.map((l) => l.url)).toEqual(['https://a', 'https://b']);
    expect(links[0]!.title).toBeUndefined();
    await repo.updateLink(t.id, links[0]!.id, { title: 'Ay' });
    await repo.removeLink(t.id, links[1]!.id);
    links = (await db.techniques.get(t.id))!.links;
    expect(links).toHaveLength(1);
    expect(links[0]!.title).toBe('Ay');
    await expect(repo.addLink(t.id, { url: '  ' })).rejects.toThrow(/URL/);
  });
});
