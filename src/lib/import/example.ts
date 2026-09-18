import exampleJson from '../../../examples/example-book.json';
import { importBook, validateBookFile, type BookImportSummary } from './bookImport';

/** Import the bundled example Book so a first run has something to explore. */
export async function loadExampleBook(): Promise<BookImportSummary> {
  return importBook(validateBookFile(exampleJson));
}
