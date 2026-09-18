import { liveQuery } from 'dexie';
import { db } from '../db/db';
import type { Book, Chapter, Technique } from '../model/types';

/**
 * Live, reactive mirror of the database. The dataset is small (hundreds to low thousands of
 * techniques) so views subscribe to whole tables and filter in memory.
 */
class LiveData {
  books = $state<Book[]>([]);
  chapters = $state<Chapter[]>([]);
  techniques = $state<Technique[]>([]);
  ready = $state(false);
  error = $state<string | null>(null);
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    let loaded = 0;
    const done = () => {
      loaded++;
      if (loaded >= 3) this.ready = true;
    };
    const onError = (e: unknown) => {
      this.error = e instanceof Error ? e.message : String(e);
    };
    liveQuery(() => db.books.orderBy('ordering').toArray()).subscribe({
      next: (v) => {
        this.books = v;
        done();
      },
      error: onError,
    });
    liveQuery(() => db.chapters.toArray()).subscribe({
      next: (v) => {
        this.chapters = v;
        done();
      },
      error: onError,
    });
    liveQuery(() => db.techniques.toArray()).subscribe({
      next: (v) => {
        this.techniques = v;
        done();
      },
      error: onError,
    });
  }

  book(id: string | undefined) {
    return id ? this.books.find((b) => b.id === id) : undefined;
  }
  chapter(id: string | undefined) {
    return id ? this.chapters.find((c) => c.id === id) : undefined;
  }
  technique(id: string | undefined) {
    return id ? this.techniques.find((t) => t.id === id) : undefined;
  }
  chaptersOf(bookId: string) {
    return this.chapters.filter((c) => c.bookId === bookId).sort((a, b) => a.ordering - b.ordering);
  }
  techniquesOf(chapterId: string) {
    return this.techniques
      .filter((t) => t.chapterId === chapterId)
      .sort((a, b) => a.ordering - b.ordering);
  }
}

export const data = new LiveData();
