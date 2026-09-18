import { DEFAULT_FILTERS, type Filters } from '../model/filter';

const KEY = 'jju-companion:prefs';

interface Stored {
  filters?: Partial<Filters>;
  inactiveBookIds?: string[];
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    return {};
  }
}

function save(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: preferences simply do not persist */
  }
}

/** View preferences: filters, sort and which Books are active. Never touches stored data. */
class Prefs {
  filters = $state<Filters>({ ...DEFAULT_FILTERS });
  inactiveBookIds = $state<string[]>([]);

  constructor() {
    const s = load();
    this.filters = { ...DEFAULT_FILTERS, ...(s.filters ?? {}) };
    this.inactiveBookIds = Array.isArray(s.inactiveBookIds) ? s.inactiveBookIds : [];
  }

  isActive(bookId: string) {
    return !this.inactiveBookIds.includes(bookId);
  }
  setActive(bookId: string, active: boolean) {
    const without = this.inactiveBookIds.filter((id) => id !== bookId);
    this.inactiveBookIds = active ? without : [...without, bookId];
  }
  selectAll() {
    this.inactiveBookIds = [];
  }
  selectNone(allIds: string[]) {
    this.inactiveBookIds = [...allIds];
  }
  clearFilters() {
    this.filters = { ...DEFAULT_FILTERS };
  }
}

export const prefs = new Prefs();

$effect.root(() => {
  $effect(() => {
    save({
      filters: $state.snapshot(prefs.filters),
      inactiveBookIds: $state.snapshot(prefs.inactiveBookIds),
    });
  });
});
