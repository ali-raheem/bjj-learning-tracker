#!/usr/bin/env node
// Convert a plain-text Book (see src/lib/import/textBook.js for the format) to a Book JSON file.
//   node scripts/text-to-book.mjs books/jju.txt                 -> writes books/jju.json
//   node scripts/text-to-book.mjs books/jju.txt -o out.json
//   node scripts/text-to-book.mjs books/jju.txt --check         -> validate only
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parseTextBook, TextBookError } from '../src/lib/import/textBook.js';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('-'));
const outIdx = args.indexOf('-o');
const check = args.includes('--check');
if (!input) {
  console.error('usage: text-to-book.mjs <file.txt> [-o out.json] [--check]');
  process.exit(2);
}

try {
  const text = readFileSync(input, 'utf8');
  const fallbackName = basename(input).replace(/\.[^.]+$/, '');
  const book = parseTextBook(text, { fallbackName });
  const techniques = book.book.chapters.reduce((s, c) => s + c.techniques.length, 0);
  if (check) {
    console.log(
      `ok: "${book.book.name}" (${book.book.externalId}) — ${book.book.chapters.length} chapters, ${techniques} techniques`,
    );
    process.exit(0);
  }
  const out = outIdx !== -1 ? args[outIdx + 1] : input.replace(/\.[^.]+$/, '') + '.json';
  writeFileSync(out, JSON.stringify(book, null, 2) + '\n');
  console.log(`wrote ${out}: ${book.book.chapters.length} chapters, ${techniques} techniques`);
} catch (e) {
  if (e instanceof TextBookError) {
    console.error(e.summary);
    for (const p of e.problems) console.error('  - ' + p);
  } else {
    console.error(e.message);
  }
  process.exit(1);
}
