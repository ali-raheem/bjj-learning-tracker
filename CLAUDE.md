# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev          # Vite dev server (hash routes: #/, #/technique/:id, #/books, #/books/:id, #/backup)
npm run build        # production build + PWA service worker into dist/
npm run preview      # serve dist/ on http://localhost:4173
npm run check        # svelte-check (TypeScript + Svelte types)
npm run lint         # prettier --check
npm run format       # prettier --write
npm test             # vitest, all tests
npx vitest run tests/bookImport.test.ts          # one file
npx vitest run -t "preserves user data"          # one test by name
scripts/deploy.sh    # build and rsync dist/ to https://shoryuken.me/bjj/ (see Deployment)
npm run book -- books/jju.txt --check   # validate a plain-text Book; drop --check to write .json
npm run e2e           # Playwright: builds, serves dist/, runs the full browser suite
npx playwright test tests-e2e/import.spec.ts   # one e2e file
npm run e2e -- -g "re-importing"               # one e2e test by name
```

Tests run in Node against `fake-indexeddb` (see `tests/setup.ts`); each test creates its own
`AppDatabase` via `freshDb()` in `tests/helpers.ts`. `npm run e2e` is a separate, slower browser
suite (`tests-e2e/`, Playwright Test) covering the Svelte UI end to end against a real production
build; kept out of `npm test` so the fast unit suite stays fast. Each Playwright test gets its own
browser context, so IndexedDB is isolated per test with no extra fixture work.

If vitest dies with `Bus error (core dumped)`, a native binary in `node_modules` is truncated
(it happened once after an interrupted install). Fix with `rm -rf node_modules && npm ci`.

## Deployment

Live at `https://shoryuken.me/bjj/`, served by nginx on the `ursula` server (`root@185.163.204.17`,
Debian 12, behind Cloudflare). `scripts/deploy.sh` builds and rsyncs `dist/` to
`/var/www/shoryuken.me/bjj/`. The app is built with `base: '/bjj/'` (see `vite.config.ts`; set
`VITE_BASE=/` to build for root hosting). The nginx `location /bjj/` blocks live in
`/etc/nginx/sites-enabled/shoryuken.me` next to the other subpath apps (`/cc/`, `/at/`):
`index.html`, `sw.js` and the manifest are `no-cache` so Cloudflare never pins an old service
worker; `/bjj/assets/` is immutable. The server has no git checkout; deploys are push-only from
a local build.

`scripts/deploy.sh` also publishes every `.txt` file under `books/` to
`https://shoryuken.me/books/<name>.txt`. These are plain downloads (not part of the app or its
service worker), so a Book file can be opened and saved on a phone, then picked from Import Book
file. Re-run the script after editing a `books/*.txt` file to update the published copy.

The Backup screen shows a build version (`git rev-parse --short HEAD` + committer date, baked in
by `vite.config.ts` via `define`). **Commit before building/deploying**, not after — the hash is
read from the working tree at build time, so building with uncommitted changes stamps the version
with a `(modified)` suffix instead of the commit that's actually live.

## Stack and Layout

Svelte 5 (runes) + Vite 7 + TypeScript, Dexie 4 over IndexedDB, `marked` + DOMPurify for notes,
`vite-plugin-pwa` for offline/install. No router library: `src/lib/ui/router.svelte.ts` parses
`location.hash`.

```
src/lib/model/types.ts     Book / Chapter / Technique / TechniqueLink, SourceStatus, helpers
src/lib/model/filter.ts    pure filter, sort and group functions (tested)
src/lib/db/db.ts           Dexie schema (bump version + add .upgrade() on shape changes)
src/lib/db/repo.ts         Repo class: every mutation, each a single transaction
src/lib/import/bookImport.ts   Book file validation, merge-by-externalId import, Book export
src/lib/import/backup.ts       full backup export, validation, migrate, replace/merge restore
src/lib/import/textBook.js     plain-text Book format parser (JS with JSDoc: no imports, so the
                               CLI can run it under plain Node); anyBook.ts picks JSON vs text
tests-e2e/*.spec.ts        Playwright end-to-end suite (npm run e2e); fixtures.ts has in-memory
                           file-upload helpers and filterSelect() (the filter panel's <select>s
                           sit in a <label> whose accessible name also picks up every <option>'s
                           text, e.g. "Drilled" collides with "Drilled or sparred" and "Drilled
                           first" elsewhere, so getByLabel is unreliable there — scope by the
                           caption <span> instead)
books/core-curriculum.txt  built-in starter Book (belt-organised core techniques), bundled via
                           `?raw` and imported by "Load starter curriculum" on the empty screen
books/jju.txt              the user's JJU transcription in the text format (source of truth
                           for that Book; import it directly, the app reads .txt)
src/lib/ui/data.svelte.ts  live mirror of all three tables via Dexie liveQuery
src/lib/ui/prefs.svelte.ts filters, sort and inactive Books, persisted to localStorage
src/routes/*.svelte        one component per screen
examples/example-book.json sample Book file in the import format
```

Views subscribe to whole tables and filter in memory; there is no per-query IndexedDB access
in the UI. Links are embedded as an array on the Technique record rather than a separate table.

**Gotcha:** values from `data.*` or any `$state` are proxies. Pass `$state.snapshot(x)` before
handing an object to Dexie, or IndexedDB will throw `DataCloneError`.

Note: `../CLAUDE.md` describes the shoryuken.me workspace and its shared-origin rules. The one
above it, `~/Workspace/CLAUDE.md`, belongs to an unrelated Rust project (a Fallout save editor);
ignore its commands and architecture here.

## What the App Is

A lightweight, local-first, offline-capable web app (phone-first, installable as a PWA) for tracking progression through BJJ techniques. Per technique it tracks **Read** (bool), **Drilled** (bool), **Sparred** (integer 0–3, shown as three markers), Markdown notes, external links, and archived status. The core workflow is surfacing techniques that are Read + Drilled but Sparred < 3, sorted by least sparred first.

Navigation is minimal: **Techniques** (list, search, filters, quick progress edits), **Books** (manage sources/chapters/techniques), **Backup** (export/import/restore). No dashboards, gamification, accounts, or sync in MVP (see spec §32–33 for the exact MVP/out-of-scope lists).

Full behavioural spec: `Proposal.md`. It is the source of truth for scope; §32–33 list MVP and out-of-scope items.

## Domain Model

Hierarchy: `Book → Chapter → Technique → TechniqueLink`. A "Book" is any collection of material (published book, course, gym curriculum, personal list), not necessarily a literal book.

Every Book, Chapter and Technique has an immutable internal UUID. Imported entities additionally carry a stable `externalId` (e.g. `jju:closed-guard:flower-sweep`). **Names are display properties only and must never be used as identifiers.**

## Architectural Invariants

These come from the spec and shape the data layer; violating them breaks the product's central promise of surviving source updates.

- **Source data vs. user data are separate.** Source-controlled: book/chapter/technique names, structure, ordering, external IDs, source version. User-controlled: read, drilled, sparringSuccesses, notesMarkdown, links, archived, custom additions. Imports update the former and must never overwrite the latter.
- **Book import merges by `externalId`.** Re-importing a newer version of a source (renames, moves between chapters, added/removed items) must preserve all user progress on matched IDs. Ambiguous or invalid conflicts abort the import with an error rather than partially applying.
- **Removed source items become "orphaned from source"**, keeping the full user record. The user then chooses to keep, move, archive, or delete.
- **Archive over delete.** Archiving hides from default views/filters and is reversible. Permanent deletion exists only as an explicit, confirmed destructive action. Removing a Book must not corrupt unrelated technique data.
- **User-created and imported Books behave identically** in the UI; the distinction is internal (`sourceType`).
- **Two distinct import paths**: *Import Book* (source definition, merges) and *Restore Backup* (whole database, replace or merge, with validation of JSON, schema version, required IDs, duplicates). Both are clearly different operations in the UI.
- **Every export/import format carries `schemaVersion`.** Future versions migrate old data rather than rejecting it. Full backup JSON must be sufficient to recreate state on another install.
- **Persistence is IndexedDB**, not localStorage. Filter/sort/active-Book preferences persist across sessions but are view state, never mutating stored data.
- **Progress editing is inline and auto-saved.** Sparring markers and Read/Drilled toggles are editable directly from the list without opening a form. Sparred is capped at 3 in the UI; a failed attempt never decrements. Read is not a prerequisite for Drilled.

## Import File Format

Curated sources (e.g. a Jiu-Jitsu University index) live outside the app as JSON:

```json
{ "schemaVersion": 1, "type": "book",
  "book": { "externalId": "jju", "name": "...", "version": "1.0",
            "chapters": [ { "externalId": "...", "name": "...",
                            "techniques": [ { "externalId": "...", "name": "..." } ] } ] } }
```

See spec §14–16 and §31 for merge and conflict semantics.
