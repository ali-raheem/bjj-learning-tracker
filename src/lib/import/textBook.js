// @ts-check
/**
 * Plain-text Book format, for transcribing a curriculum in any notes app.
 *
 *   book: Jiu-Jitsu University        header lines (before the first chapter)
 *   id: jju                           optional; defaults to a slug of the book name
 *   version: 1
 *   description: Technique index
 *
 *   # White · Mount survival          chapter; optional " | chapter-id"
 *   Basic posture                     technique; optional " | technique-id"
 *   Hip escape | hip-escape-mount     pin an id when the name is a duplicate or may change
 *   // a comment
 *
 * Ids default to a slug of the name. Technique ids must be unique across the whole book so a
 * technique keeps its progress when it moves between chapters. This file has no imports so the
 * CLI in scripts/text-to-book.mjs can use it under plain Node.
 */

export const TEXT_BOOK_SCHEMA_VERSION = 1;

export class TextBookError extends Error {
  /** @param {string} summary @param {string[]} problems */
  constructor(summary, problems = []) {
    super(problems.length ? `${summary}: ${problems.join('; ')}` : summary);
    this.name = 'TextBookError';
    this.summary = summary;
    this.problems = problems;
  }
}

/** @param {string} s */
export function slugify(s) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * @param {string} line
 * @returns {{ name: string, id: string | undefined }}
 */
function splitNameAndId(line) {
  const bar = line.lastIndexOf('|');
  if (bar === -1) return { name: line.trim(), id: undefined };
  return { name: line.slice(0, bar).trim(), id: line.slice(bar + 1).trim() || undefined };
}

/**
 * Looks like a text Book rather than JSON: JSON files start with "{".
 * @param {string} text
 */
export function looksLikeTextBook(text) {
  return !text.trimStart().startsWith('{');
}

/**
 * @typedef {{ externalId: string, name: string }} TechniqueDef
 * @typedef {{ externalId: string, name: string, techniques: TechniqueDef[] }} ChapterDef
 * @typedef {{ externalId: string, name: string, version?: string, description?: string, chapters: ChapterDef[] }} BookDef
 * @typedef {{ schemaVersion: number, type: 'book', book: BookDef }} BookFile
 */

/**
 * Parse the plain-text format into a Book file object. Throws `TextBookError` listing every
 * problem found (with line numbers) rather than stopping at the first.
 *
 * @param {string} text
 * @param {{ fallbackName?: string }} [options] name used when the file has no `book:` header,
 *   typically the file name without extension.
 * @returns {BookFile}
 */
export function parseTextBook(text, options = {}) {
  /** @type {string[]} */
  const problems = [];
  /** @type {Record<string, string>} */
  const headers = {};
  /** @type {ChapterDef[]} */
  const chapters = [];
  /** @type {Map<string, number>} */
  const chapterIds = new Map();
  /** @type {Map<string, number>} */
  const techniqueIds = new Map();
  /** @type {ChapterDef | null} */
  let current = null;

  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const n = i + 1;
    const line = raw.trim();
    if (!line || line.startsWith('//')) return;

    if (line.startsWith('#')) {
      const { name, id } = splitNameAndId(line.replace(/^#+\s*/, ''));
      if (!name) {
        problems.push(`line ${n}: chapter heading has no name`);
        return;
      }
      const externalId = id ?? slugify(name);
      if (!externalId)
        problems.push(`line ${n}: cannot make an id from "${name}"; add "| some-id"`);
      else if (chapterIds.has(externalId))
        problems.push(
          `line ${n}: chapter id "${externalId}" already used on line ${chapterIds.get(externalId)}; add "| some-id" to one of them`,
        );
      else chapterIds.set(externalId, n);
      current = { externalId, name, techniques: [] };
      chapters.push(current);
      return;
    }

    if (!current) {
      const m = /^([a-zA-Z]+)\s*:\s*(.*)$/.exec(line);
      if (m && m[1] && ['book', 'id', 'version', 'description'].includes(m[1].toLowerCase())) {
        headers[m[1].toLowerCase()] = (m[2] ?? '').trim();
        return;
      }
      problems.push(
        `line ${n}: "${line}" appears before the first chapter; expected a header like "book: Name" or a "# Chapter" line`,
      );
      return;
    }

    const { name, id } = splitNameAndId(line);
    if (!name) {
      problems.push(`line ${n}: technique has no name`);
      return;
    }
    const externalId = id ?? slugify(name);
    if (!externalId) {
      problems.push(`line ${n}: cannot make an id from "${name}"; add "| some-id"`);
      return;
    }
    if (techniqueIds.has(externalId)) {
      problems.push(
        `line ${n}: "${name}" has the same id "${externalId}" as line ${techniqueIds.get(externalId)}; add "| some-id" to one of them`,
      );
      return;
    }
    techniqueIds.set(externalId, n);
    current.techniques.push({ externalId, name });
  });

  const name = headers.book || options.fallbackName?.trim() || '';
  if (!name) problems.push('missing "book: Name" header');
  const externalId = headers.id || slugify(name);
  if (name && !externalId)
    problems.push('cannot make a book id from the name; add an "id:" header');
  if (chapters.length === 0) problems.push('no chapters; add at least one "# Chapter" line');

  if (problems.length) throw new TextBookError('Invalid text Book file', problems);

  /** @type {BookDef} */
  const book = { externalId, name, chapters };
  if (headers.version) book.version = headers.version;
  if (headers.description) book.description = headers.description;
  return { schemaVersion: TEXT_BOOK_SCHEMA_VERSION, type: 'book', book };
}
