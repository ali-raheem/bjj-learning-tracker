import { parseBookFile, validateBookFile, type BookFile } from './bookImport';
import { looksLikeTextBook, parseTextBook, TextBookError } from './textBook.js';
import { ImportError } from './validation';

/** Strip the extension from a file name for use as a fallback Book name. */
export function nameFromFilename(filename: string | undefined): string | undefined {
  if (!filename) return undefined;
  const base = filename.replace(/\.[^.]+$/, '').trim();
  return base || undefined;
}

/**
 * Parse either a JSON Book file or the plain-text format, based on content rather than
 * extension. Text output is run through the same validator as JSON.
 */
export function parseAnyBookFile(text: string, filename?: string): BookFile {
  if (!looksLikeTextBook(text)) return parseBookFile(text);
  try {
    return validateBookFile(parseTextBook(text, { fallbackName: nameFromFilename(filename) }));
  } catch (e) {
    if (e instanceof TextBookError) throw new ImportError(e.summary, e.problems);
    throw e;
  }
}

export const BOOK_FILE_ACCEPT = 'application/json,.json,text/plain,.txt,.md';
