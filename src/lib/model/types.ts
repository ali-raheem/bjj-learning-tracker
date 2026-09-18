/** Where a Book came from. User-created and imported Books behave identically in the UI. */
export type SourceType = 'user' | 'imported';

/**
 * Relationship of a Chapter/Technique to its Book's source definition.
 * - `user`: created by the user (never touched by imports).
 * - `present`: defined by the most recent import of the Book's source.
 * - `orphaned`: was defined by an earlier import but is absent from the latest one.
 */
export type SourceStatus = 'user' | 'present' | 'orphaned';

export interface Book {
  id: string;
  externalId?: string;
  sourceType: SourceType;
  sourceVersion?: string;
  name: string;
  description?: string;
  ordering: number;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  externalId?: string;
  bookId: string;
  name: string;
  ordering: number;
  sourceStatus: SourceStatus;
}

export interface TechniqueLink {
  id: string;
  title?: string;
  url: string;
}

export const MAX_SPARRING = 3;

export interface Technique {
  id: string;
  externalId?: string;
  bookId: string;
  chapterId: string;
  name: string;
  read: boolean;
  drilled: boolean;
  sparringSuccesses: number;
  notesMarkdown: string;
  links: TechniqueLink[];
  archived: boolean;
  sourceStatus: SourceStatus;
  ordering: number;
  createdAt: string;
  updatedAt: string;
}

/** The user-controlled fields of a Technique. Imports must never overwrite these. */
export type TechniqueUserData = Pick<
  Technique,
  'read' | 'drilled' | 'sparringSuccesses' | 'notesMarkdown' | 'links' | 'archived'
>;

export const DEFAULT_USER_DATA: TechniqueUserData = {
  read: false,
  drilled: false,
  sparringSuccesses: 0,
  notesMarkdown: '',
  links: [],
  archived: false,
};

/** True when the user has recorded anything against the technique beyond the defaults. */
export function hasUserData(t: TechniqueUserData): boolean {
  return (
    t.read ||
    t.drilled ||
    t.sparringSuccesses > 0 ||
    t.notesMarkdown.trim() !== '' ||
    t.links.length > 0 ||
    t.archived
  );
}

export function clampSparring(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_SPARRING, Math.round(n)));
}

export function newId(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}
