import { db as defaultDb, type AppDatabase } from './db';
import {
  DEFAULT_USER_DATA,
  clampSparring,
  newId,
  now,
  type Book,
  type Chapter,
  type Technique,
  type TechniqueLink,
  type TechniqueUserData,
} from '../model/types';

async function nextOrdering(items: { ordering: number }[]): Promise<number> {
  return items.reduce((max, i) => Math.max(max, i.ordering), -1) + 1;
}

/**
 * All mutations of the local database go through here. Every method is a single Dexie
 * transaction so partial writes are never observed.
 */
export class Repo {
  constructor(readonly db: AppDatabase = defaultDb) {}

  // ---------------------------------------------------------------- Books

  async createBook(input: { name: string; description?: string }): Promise<Book> {
    const name = input.name.trim();
    if (!name) throw new Error('Book name is required');
    return this.db.transaction('rw', this.db.books, async () => {
      const ts = now();
      const book: Book = {
        id: newId(),
        sourceType: 'user',
        name,
        description: input.description?.trim() || undefined,
        ordering: await nextOrdering(await this.db.books.toArray()),
        hidden: false,
        createdAt: ts,
        updatedAt: ts,
      };
      await this.db.books.add(book);
      return book;
    });
  }

  async updateBook(
    id: string,
    patch: Partial<Pick<Book, 'name' | 'description' | 'hidden'>>,
  ): Promise<void> {
    const clean: Partial<Book> = { ...patch, updatedAt: now() };
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new Error('Book name is required');
      clean.name = name;
    }
    if (patch.description !== undefined) clean.description = patch.description.trim() || undefined;
    await this.db.books.update(id, clean);
  }

  /** Deletes a Book and everything in it. Other Books are untouched. */
  async deleteBook(id: string): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.books, this.db.chapters, this.db.techniques],
      async () => {
        await this.db.techniques.where('bookId').equals(id).delete();
        await this.db.chapters.where('bookId').equals(id).delete();
        await this.db.books.delete(id);
      },
    );
  }

  /** Persist a complete new order of Book ids. Ids not listed keep their relative order after. */
  async reorderBooks(orderedIds: string[]): Promise<void> {
    await this.db.transaction('rw', this.db.books, async () => {
      const all = await this.db.books.orderBy('ordering').toArray();
      const rest = all.filter((b) => !orderedIds.includes(b.id)).map((b) => b.id);
      const ids = [...orderedIds, ...rest];
      await Promise.all(ids.map((id, i) => this.db.books.update(id, { ordering: i })));
    });
  }

  // ------------------------------------------------------------- Chapters

  async createChapter(bookId: string, name: string): Promise<Chapter> {
    const clean = name.trim();
    if (!clean) throw new Error('Chapter name is required');
    return this.db.transaction('rw', [this.db.books, this.db.chapters], async () => {
      if (!(await this.db.books.get(bookId))) throw new Error('Book not found');
      const siblings = await this.db.chapters.where('bookId').equals(bookId).toArray();
      const chapter: Chapter = {
        id: newId(),
        bookId,
        name: clean,
        ordering: await nextOrdering(siblings),
        sourceStatus: 'user',
      };
      await this.db.chapters.add(chapter);
      return chapter;
    });
  }

  async renameChapter(id: string, name: string): Promise<void> {
    const clean = name.trim();
    if (!clean) throw new Error('Chapter name is required');
    await this.db.chapters.update(id, { name: clean });
  }

  /** Deletes a Chapter and all techniques in it. */
  async deleteChapter(id: string): Promise<void> {
    await this.db.transaction('rw', [this.db.chapters, this.db.techniques], async () => {
      await this.db.techniques.where('chapterId').equals(id).delete();
      await this.db.chapters.delete(id);
    });
  }

  async reorderChapters(bookId: string, orderedIds: string[]): Promise<void> {
    await this.db.transaction('rw', this.db.chapters, async () => {
      const all = await this.db.chapters.where('bookId').equals(bookId).sortBy('ordering');
      const rest = all.filter((c) => !orderedIds.includes(c.id)).map((c) => c.id);
      const ids = [...orderedIds, ...rest];
      await Promise.all(ids.map((id, i) => this.db.chapters.update(id, { ordering: i })));
    });
  }

  // ----------------------------------------------------------- Techniques

  async createTechnique(
    chapterId: string,
    input: { name: string } & Partial<TechniqueUserData>,
  ): Promise<Technique> {
    const name = input.name.trim();
    if (!name) throw new Error('Technique name is required');
    return this.db.transaction('rw', [this.db.chapters, this.db.techniques], async () => {
      const chapter = await this.db.chapters.get(chapterId);
      if (!chapter) throw new Error('Chapter not found');
      const siblings = await this.db.techniques.where('chapterId').equals(chapterId).toArray();
      const ts = now();
      const technique: Technique = {
        id: newId(),
        bookId: chapter.bookId,
        chapterId,
        name,
        ...DEFAULT_USER_DATA,
        ...stripUndefined(input),
        sparringSuccesses: clampSparring(input.sparringSuccesses ?? 0),
        links: (input.links ?? []).map(normaliseLink),
        sourceStatus: 'user',
        ordering: await nextOrdering(siblings),
        createdAt: ts,
        updatedAt: ts,
      };
      technique.name = name;
      await this.db.techniques.add(technique);
      return technique;
    });
  }

  async updateTechnique(
    id: string,
    patch: Partial<Pick<Technique, 'name'> & TechniqueUserData>,
  ): Promise<void> {
    const clean: Partial<Technique> = { ...stripUndefined(patch), updatedAt: now() };
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new Error('Technique name is required');
      clean.name = name;
    }
    if (patch.sparringSuccesses !== undefined)
      clean.sparringSuccesses = clampSparring(patch.sparringSuccesses);
    if (patch.links !== undefined) clean.links = patch.links.map(normaliseLink);
    await this.db.techniques.update(id, clean);
  }

  async setRead(id: string, read: boolean) {
    await this.updateTechnique(id, { read });
  }
  async setDrilled(id: string, drilled: boolean) {
    await this.updateTechnique(id, { drilled });
  }
  async setSparring(id: string, count: number) {
    await this.updateTechnique(id, { sparringSuccesses: count });
  }
  async setArchived(id: string, archived: boolean) {
    await this.updateTechnique(id, { archived });
  }

  async addLink(id: string, link: { url: string; title?: string }): Promise<void> {
    await this.db.transaction('rw', this.db.techniques, async () => {
      const t = await this.db.techniques.get(id);
      if (!t) throw new Error('Technique not found');
      await this.updateTechnique(id, { links: [...t.links, { id: newId(), ...link }] });
    });
  }

  async updateLink(id: string, linkId: string, patch: { url?: string; title?: string }) {
    await this.db.transaction('rw', this.db.techniques, async () => {
      const t = await this.db.techniques.get(id);
      if (!t) throw new Error('Technique not found');
      const links = t.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l));
      await this.updateTechnique(id, { links });
    });
  }

  async removeLink(id: string, linkId: string) {
    await this.db.transaction('rw', this.db.techniques, async () => {
      const t = await this.db.techniques.get(id);
      if (!t) throw new Error('Technique not found');
      await this.updateTechnique(id, { links: t.links.filter((l) => l.id !== linkId) });
    });
  }

  /** Permanent deletion. Prefer `setArchived` for normal use. */
  async deleteTechnique(id: string): Promise<void> {
    await this.db.techniques.delete(id);
  }

  /**
   * Move a Technique to another Chapter, possibly in another Book.
   * Moving out of its source Book detaches it from that source (it becomes user-owned),
   * otherwise the next import would pull it back or duplicate it.
   */
  async moveTechnique(id: string, toChapterId: string): Promise<void> {
    await this.db.transaction('rw', [this.db.chapters, this.db.techniques], async () => {
      const t = await this.db.techniques.get(id);
      if (!t) throw new Error('Technique not found');
      const chapter = await this.db.chapters.get(toChapterId);
      if (!chapter) throw new Error('Chapter not found');
      const siblings = await this.db.techniques.where('chapterId').equals(toChapterId).toArray();
      const patch: Partial<Technique> = {
        chapterId: toChapterId,
        bookId: chapter.bookId,
        ordering: await nextOrdering(siblings),
        updatedAt: now(),
      };
      if (chapter.bookId !== t.bookId && t.sourceStatus !== 'user') {
        patch.sourceStatus = 'user';
        patch.externalId = undefined;
      }
      await this.db.techniques.update(id, patch);
    });
  }

  async reorderTechniques(chapterId: string, orderedIds: string[]): Promise<void> {
    await this.db.transaction('rw', this.db.techniques, async () => {
      const all = await this.db.techniques.where('chapterId').equals(chapterId).sortBy('ordering');
      const rest = all.filter((t) => !orderedIds.includes(t.id)).map((t) => t.id);
      const ids = [...orderedIds, ...rest];
      await Promise.all(ids.map((id, i) => this.db.techniques.update(id, { ordering: i })));
    });
  }

  // ---------------------------------------------------------------- Misc

  async clearAll(): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.books, this.db.chapters, this.db.techniques],
      async () => {
        await this.db.techniques.clear();
        await this.db.chapters.clear();
        await this.db.books.clear();
      },
    );
  }
}

function normaliseLink(
  l: TechniqueLink | { url: string; title?: string; id?: string },
): TechniqueLink {
  const url = l.url.trim();
  if (!url) throw new Error('Link URL is required');
  const title = l.title?.trim();
  return { id: l.id ?? newId(), url, ...(title ? { title } : {}) };
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) (out as any)[k] = v;
  return out;
}

export const repo = new Repo();
