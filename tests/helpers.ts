import { AppDatabase } from '../src/lib/db/db';
import { Repo } from '../src/lib/db/repo';
import type { BookFile } from '../src/lib/import/bookImport';

let counter = 0;

export function freshDb(): { db: AppDatabase; repo: Repo } {
  const db = new AppDatabase(`test-${Date.now()}-${counter++}`);
  return { db, repo: new Repo(db) };
}

export function jjuV1(): BookFile {
  return {
    schemaVersion: 1,
    type: 'book',
    book: {
      externalId: 'jju',
      name: 'Jiu-Jitsu University',
      version: '1.0',
      chapters: [
        {
          externalId: 'closed-guard',
          name: 'Closed Guard',
          techniques: [
            { externalId: 'flower-sweep', name: 'Flower Sweep' },
            { externalId: 'scissor-sweep', name: 'Scissor Sweep' },
            { externalId: 'hip-bump', name: 'Hip Bump Sweep' },
          ],
        },
        {
          externalId: 'half-guard',
          name: 'Half Guard',
          techniques: [{ externalId: 'knee-shield', name: 'Knee Shield Recovery' }],
        },
      ],
    },
  };
}

/** v1.1: renames flower sweep, moves scissor sweep to a new chapter, drops hip bump, drops half guard. */
export function jjuV1_1(): BookFile {
  return {
    schemaVersion: 1,
    type: 'book',
    book: {
      externalId: 'jju',
      name: 'Jiu-Jitsu University (2nd ed.)',
      version: '1.1',
      chapters: [
        {
          externalId: 'closed-guard',
          name: 'Closed Guard Fundamentals',
          techniques: [{ externalId: 'flower-sweep', name: 'Flower / Pendulum Sweep' }],
        },
        {
          externalId: 'sweeps',
          name: 'Sweeps',
          techniques: [
            { externalId: 'scissor-sweep', name: 'Scissor Sweep' },
            { externalId: 'new-sweep', name: 'Brand New Sweep' },
          ],
        },
      ],
    },
  };
}
