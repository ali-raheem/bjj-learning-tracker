# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current State

This repository contains only `Proposal.md`, the full application specification for a BJJ (Brazilian Jiu-Jitsu) learning tracker. No source code, build tooling, or tests exist yet. Read `Proposal.md` in full before implementing anything; it is the source of truth for scope and behaviour.

Note: the parent directory `../CLAUDE.md` belongs to an unrelated Rust project (a Fallout save editor). Ignore its commands and architecture here.

## Commands

None yet. Once a stack is chosen, record here: install, dev server, build, lint, test (full suite and single test). Prefer whatever the chosen framework's conventional commands are, and keep them in `package.json` scripts (or equivalent) so this section stays short.

## What the App Is

A lightweight, local-first, offline-capable web app (phone-first, installable as a PWA later) for tracking progression through BJJ techniques. Per technique it tracks **Read** (bool), **Drilled** (bool), **Sparred** (integer 0–3, shown as three markers), Markdown notes, external links, and archived status. The core workflow is surfacing techniques that are Read + Drilled but Sparred < 3, sorted by least sparred first.

Navigation is minimal: **Techniques** (list, search, filters, quick progress edits), **Books** (manage sources/chapters/techniques), **Backup** (export/import/restore). No dashboards, gamification, accounts, or sync in MVP (see spec §32–33 for the exact MVP/out-of-scope lists).

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
