import Dexie, { type EntityTable } from 'dexie';
import type { Book, Chapter, Technique } from '../model/types';

export const DB_NAME = 'jju-companion';

/**
 * Schema version history. Bump the Dexie version and add an `.upgrade()` when the stored
 * shape changes; never rely on the current shape being permanent.
 */
export class AppDatabase extends Dexie {
  books!: EntityTable<Book, 'id'>;
  chapters!: EntityTable<Chapter, 'id'>;
  techniques!: EntityTable<Technique, 'id'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      books: 'id, externalId, ordering',
      chapters: 'id, bookId, externalId, [bookId+ordering]',
      techniques: 'id, bookId, chapterId, externalId, archived, [chapterId+ordering]',
    });
  }
}

export const db = new AppDatabase();
