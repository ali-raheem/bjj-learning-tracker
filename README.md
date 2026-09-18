# BJJ Learning Tracker

A local-first, offline-capable web app for tracking Brazilian Jiu-Jitsu techniques: what you
have **read**, what you have **drilled**, and how many times you have **used it in sparring**
(up to three). Designed for phones, installable as a PWA, no accounts or server.

Techniques are organised into **Books** (any collection: a published book, a course, your gym's
curriculum, your own list) and **Chapters**. Each technique has Markdown notes, links, and can be
archived. Filter to *Read + Drilled + Sparred < 3, least sparred first* to get a queue of things
to try in live rolling.

## Run

```bash
npm install
npm run dev        # development server
npm run build      # production build in dist/
npm test           # unit tests
```

## Data

Everything is stored in the browser's IndexedDB. Use **Backup** in the app to export a full JSON
backup and to restore one (replace or merge).

Curricula can be imported from a Book file, either JSON (see `examples/example-book.json`) or
plain text, which is easier to write in a notes app:

```
book: My Gym Curriculum

# Closed guard
Flower sweep
Scissor sweep
```

The app imports `.txt` files directly. `books/core-curriculum.txt` is the built-in starter, a
core technique list by belt from white to black, offered on first run. `books/jju.txt` is a
template for a Jiu-Jitsu University index. `npm run book -- books/jju.txt` converts text to JSON if you need the JSON form.
Every book, chapter and technique carries a stable `externalId`. Re-importing a newer version of
the same file updates names and structure while keeping your progress, notes and links. Items
dropped by the source are kept as "orphaned" if you had recorded anything against them.

The full specification is in `Proposal.md`.
