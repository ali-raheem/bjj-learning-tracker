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

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => {
        this.route = parse(location.hash);
        window.scrollTo(0, 0);
      });
    }
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
