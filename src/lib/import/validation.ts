export class ImportError extends Error {
  /** Short headline suitable for a UI title; `problems` holds the per-field details. */
  readonly summary: string;

  constructor(
    summary: string,
    readonly problems: string[] = [],
  ) {
    super(problems.length ? `${summary}: ${problems.join('; ')}` : summary);
    this.name = 'ImportError';
    this.summary = summary;
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new ImportError('File is not valid JSON', [(e as Error).message]);
  }
}

export class Problems {
  readonly list: string[] = [];
  add(path: string, msg: string) {
    this.list.push(`${path}: ${msg}`);
  }
  throwIfAny(summary: string) {
    if (this.list.length) throw new ImportError(summary, this.list);
  }
}
