import { tick } from 'svelte';

export type Route =
  | { name: 'techniques' }
  | { name: 'technique'; id: string }
  | { name: 'books' }
  | { name: 'book'; id: string }
  | { name: 'backup' };

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  const parts = path.split('/').map(decodeURIComponent);
  switch (parts[0]) {
    case 'technique':
      return parts[1] ? { name: 'technique', id: parts[1] } : { name: 'techniques' };
    case 'books':
      return parts[1] ? { name: 'book', id: parts[1] } : { name: 'books' };
    case 'backup':
      return { name: 'backup' };
    default:
      return { name: 'techniques' };
  }
}

class Router {
  route = $state<Route>(parse(typeof location === 'undefined' ? '' : location.hash));
  /** Scroll offsets by hash so that returning to a long list lands where the user left. */
  private scrollPositions = new Map<string, number>();
  private currentHash = typeof location === 'undefined' ? '' : location.hash;

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('hashchange', async () => {
      this.scrollPositions.set(this.currentHash, window.scrollY);
      this.currentHash = location.hash;
      this.route = parse(location.hash);
      const y = this.scrollPositions.get(this.currentHash) ?? 0;
      await tick();
      requestAnimationFrame(() => window.scrollTo(0, y));
    });
  }
}

export const router = new Router();

export function href(path: string): string {
  return `#/${path.replace(/^\/+/, '')}`;
}

export function navigate(path: string) {
  location.hash = href(path);
}

export function back(fallback: string) {
  if (history.length > 1) history.back();
  else navigate(fallback);
}
