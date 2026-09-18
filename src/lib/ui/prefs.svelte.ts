import {
  DEFAULT_FILTERS,
  applyPreset,
  presetActive,
  type Filters,
  type Preset,
} from '../model/filter';

const KEY = 'jju-companion:prefs';
export const BACKUP_NUDGE_DAYS = 14;

interface Stored {
  filters?: Partial<Filters>;
  inactiveBookIds?: string[];
  lastBackupAt?: string | null;
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
  lastBackupAt = $state<string | null>(null);

  constructor() {
    const s = load();
    this.filters = { ...DEFAULT_FILTERS, ...(s.filters ?? {}) };
    this.inactiveBookIds = Array.isArray(s.inactiveBookIds) ? s.inactiveBookIds : [];
    this.lastBackupAt = typeof s.lastBackupAt === 'string' ? s.lastBackupAt : null;
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

  presetActive(p: Preset) {
    return presetActive(this.filters, p);
  }
  /** Apply the preset, or clear back to defaults if it is already active. */
  togglePreset(p: Preset) {
    this.filters = this.presetActive(p)
      ? { ...DEFAULT_FILTERS, search: this.filters.search, archived: this.filters.archived }
      : applyPreset(this.filters, p);
  }

  markBackedUp() {
    this.lastBackupAt = new Date().toISOString();
  }
  /** Whole days since the last backup, or null if there has never been one. */
  backupAgeDays(): number | null {
    if (!this.lastBackupAt) return null;
    const ms = Date.now() - new Date(this.lastBackupAt).getTime();
    return Math.max(0, Math.floor(ms / 86_400_000));
  }
  backupDue(): boolean {
    const age = this.backupAgeDays();
    return age === null || age >= BACKUP_NUDGE_DAYS;
  }
}

export const prefs = new Prefs();

$effect.root(() => {
  $effect(() => {
    save({
      filters: $state.snapshot(prefs.filters),
      inactiveBookIds: $state.snapshot(prefs.inactiveBookIds),
      lastBackupAt: prefs.lastBackupAt,
    });
  });
});
