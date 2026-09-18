import { describe, expect, it } from 'vitest';
import {
  backupFilename,
  exportBackup,
  parseBackupFile,
  restoreBackup,
} from '../src/lib/import/backup';
import { importBook } from '../src/lib/import/bookImport';
import { ImportError } from '../src/lib/import/validation';
import { freshDb, jjuV1 } from './helpers';

async function seeded() {
  const ctx = freshDb();
  await importBook(jjuV1(), ctx.db);
  const b = await ctx.repo.createBook({ name: 'My No-Gi Game', description: 'stuff' });
  const c = await ctx.repo.createChapter(b.id, 'Butterfly');
  const t = await ctx.repo.createTechnique(c.id, {
    name: 'Shoulder Crunch',
    read: true,
    sparringSuccesses: 7,
    notesMarkdown: '# hi',
    links: [{ id: 'l1', url: 'https://x' }],
  });
  return { ...ctx, b, c, t };
}

describe('backup', () => {
  it('names files by date', () => {
    expect(backupFilename(new Date('2026-09-18T10:00:00Z'))).toBe(
      'bjj-tracker-backup-2026-09-18.json',
    );
  });

  it('export → parse → replace restore reproduces the database exactly', async () => {
    const src = await seeded();
    const file = await exportBackup(src.db);
    expect(file.type).toBe('backup');
    expect(file.techniques.find((t) => t.id === src.t.id)!.sparringSuccesses).toBe(3);

    const parsed = parseBackupFile(JSON.stringify(file));
    const dst = freshDb();
    await dst.repo.createBook({ name: 'to be wiped' });
    const s = await restoreBackup(parsed, 'replace', dst.db);
    expect(s).toMatchObject({ mode: 'replace', books: 2, chapters: 3, techniques: 5 });
    expect(await dst.db.books.count()).toBe(2);
    expect(await dst.db.techniques.get(src.t.id)).toEqual(await src.db.techniques.get(src.t.id));
  });

  it('merge restore keeps local records and overwrites by id', async () => {
    const src = await seeded();
    const file = await exportBackup(src.db);
    const dst = freshDb();
    const local = await dst.repo.createBook({ name: 'local only' });
    await src.repo.setRead(src.t.id, false);
    await restoreBackup(parseBackupFile(JSON.stringify(file)), 'merge', dst.db);
    expect(await dst.db.books.get(local.id)).toBeDefined();
    expect(await dst.db.books.count()).toBe(3);
    expect((await dst.db.techniques.get(src.t.id))!.read).toBe(true);
  });

  it('validates structure and referential integrity', () => {
    const bad = {
      schemaVersion: 1,
      type: 'backup',
      books: [
        { id: 'b', name: 'B', sourceType: 'user' },
        { id: 'b', name: 'dupe', sourceType: 'user' },
      ],
      chapters: [{ id: 'c', bookId: 'missing', name: 'C' }],
      techniques: [{ id: 't', chapterId: 'c', name: '', links: [{}] }],
    };
    try {
      parseBackupFile(JSON.stringify(bad));
      expect.fail('should throw');
    } catch (e) {
      const err = e as ImportError;
      const all = err.problems.join('\n');
      expect(all).toMatch(/duplicate id "b"/);
      expect(all).toMatch(/chapters\[0\]\.bookId/);
      expect(all).toMatch(/techniques\[0\]\.name: required/);
      expect(all).toMatch(/links\[0\]/);
    }
  });

  it('rejects book files and unknown versions', () => {
    expect(() => parseBackupFile(JSON.stringify(jjuV1()))).toThrow(/Not a backup/);
    expect(() =>
      parseBackupFile(
        JSON.stringify({
          schemaVersion: 2,
          type: 'backup',
          books: [],
          chapters: [],
          techniques: [],
        }),
      ),
    ).toThrow(/newer/);
  });

  it('fills sensible defaults for missing optional fields', () => {
    const minimal = {
      schemaVersion: 1,
      type: 'backup',
      books: [{ id: 'b', name: 'B', sourceType: 'user' }],
      chapters: [{ id: 'c', bookId: 'b', name: 'C', externalId: 'x' }],
      techniques: [{ id: 't', chapterId: 'c', name: 'T', sparringSuccesses: '2' }],
    };
    const f = parseBackupFile(JSON.stringify(minimal));
    expect(f.chapters[0]!.sourceStatus).toBe('present');
    expect(f.techniques[0]).toMatchObject({
      bookId: 'b',
      read: false,
      sparringSuccesses: 2,
      links: [],
      sourceStatus: 'user',
      notesMarkdown: '',
    });
  });
});
