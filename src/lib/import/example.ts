import starterText from '../../../books/core-curriculum.txt?raw';
import { importBook, validateBookFile, type BookImportSummary } from './bookImport';
import { parseTextBook } from './textBook.js';

/** Import the bundled core curriculum so a first run has something real to work with. */
export async function loadStarterBook(): Promise<BookImportSummary> {
  return importBook(validateBookFile(parseTextBook(starterText)));
}
