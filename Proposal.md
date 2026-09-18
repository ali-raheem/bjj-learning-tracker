# BJJ Learning Tracker — Application Specification

## 1. Purpose

A lightweight web application (installable and offline support) for tracking progression through Brazilian Jiu-Jitsu techniques from books, courses, curricula, coaches, or personally created collections.

The application is intentionally source-agnostic. A **Book** represents any collection of material, not necessarily a literal published book. Examples might include:

* Jiu-Jitsu University
* A no-gi course
* An ADCC study curriculum
* Techniques taught at a particular gym
* Personal techniques
* YouTube techniques to investigate

The application tracks whether each technique has been:

* **Read**
* **Drilled**
* **Successfully used in sparring**, up to a target of three successful applications

Each technique also has:

* Markdown notes
* A list of external links
* Archival status

The central workflow is to expose techniques that have been studied or drilled but have not yet become reliably usable during live sparring.

---

# 2. Core Concepts

## 2.1 Book

A **Book** is the highest-level organisational unit.

Examples:

* Jiu-Jitsu University
* My No-Gi Game
* Coach's Fundamentals Curriculum
* ADCC Techniques
* Miscellaneous Techniques

A Book contains one or more Chapters.

Books can be:

* imported from JSON;
* created manually;
* edited;
* hidden from the current view;
* removed from the application.

Removing a Book should not corrupt unrelated technique data.

---

## 2.2 Chapter

A **Chapter** belongs to a Book and contains techniques.

Examples:

**Book:** My No-Gi Game

**Chapters:**

* Guard Retention
* Butterfly Guard
* Leg Entanglements
* Wrestling
* Back Attacks

Chapters may be created, renamed, reordered and deleted.

---

## 2.3 Technique

A **Technique** is the principal tracked object.

Each technique has:

* Name
* Book
* Chapter
* Read status
* Drilled status
* Sparring success count
* Markdown notes
* Links
* Archived status
* Stable internal identifier

Example:

### Flower Sweep

Read: ✓
Drilled: ✓
Sparred: ✓ × ×

Notes:

```markdown
Make sure the outside foot is externally rotated.

Raise the opponent's leg towards the armpit rather than directly upwards.

Try this when opponent is posting strongly with the opposite arm.
```

Links:

* YouTube — Flower Sweep Details
* Instagram — Useful entry
* BJJ Fanatics — Related variation

---

# 3. Learning Progress

## 3.1 Read

Boolean value.

Represents that the user has studied or reviewed the technique sufficiently to understand what it is intended to do.

Possible values:

* Not read
* Read

---

## 3.2 Drilled

Boolean value.

Represents that the user has physically practised the technique in a cooperative or semi-cooperative context.

Possible values:

* Not drilled
* Drilled

The application should not technically require Read before Drilled.

The interface may normally display progression as:

`Read → Drilled → Sparred`

but should allow any state because real-world training will not always occur in that order.

---

## 3.3 Sparring Successes

Integer from:

`0–3`

Displayed visually as three independent markers.

Examples:

`○ ○ ○` — never successfully used

`● ○ ○` — successfully used once

`● ● ○` — successfully used twice

`● ● ●` — successfully used at least three times

A failed attempt does **not** reduce the count.

Successful uses do **not** need to occur consecutively.

The three-success limit represents reaching the application's current learning threshold rather than mastery.

Internally, the application may retain an uncapped lifetime count in future versions, but the initial UI only needs progression from 0 to 3.

---

# 4. Notes

Each Technique has one Markdown notes field.

There are not separate notes for different sources, videos or books.

Example:

```markdown
## Important detail

Outside foot should be externally rotated.

Raise the leg towards the armpit.

## Problems

When opponent postures strongly I lose the sleeve grip.

## Things to try

- Break posture first
- Control opposite sleeve
- Experiment with angle before opening guard
```

The application should provide:

* Markdown editing
* Markdown preview/rendering
* Plain text entry without requiring Markdown knowledge

The notes field should be stored exactly as Markdown text in exported data.

---

# 5. Links

Each Technique has a list of external links.

Each link contains:

* URL
* Optional title

Example:

```text
Flower Sweep Details
https://youtube.com/...

Useful Instagram Reel
https://instagram.com/...
```

Links can be:

* added;
* edited;
* deleted;
* opened in a new browser tab.

There should be no arbitrary limit on the number of links associated with a technique.

---

# 6. Main Application View

Opening the application displays the **Technique List**.

Techniques are grouped into sections according to their Chapter.

Example:

## Closed Guard

Flower Sweep
Read ✓ · Drilled ✓ · Sparred ●●○

Scissor Sweep
Read ✓ · Drilled ✓ · Sparred ●○○

Hip Bump Sweep
Read ✓ · Drilled ○ · Sparred ○○○

## Half Guard

Knee Shield Recovery
Read ✓ · Drilled ✓ · Sparred ●●●

Underhook Sweep
Read ✓ · Drilled ✓ · Sparred ○○○

The user should be able to open any technique to view or edit its complete record.

---

# 7. Active Books

The application has a Book menu.

This menu lists all available Books.

Example:

```text
Books

✓ Jiu-Jitsu University
✓ My No-Gi Game
○ Random YouTube Techniques
✓ Gym Curriculum

+ Add Book
Manage Books
```

Books can be highlighted/selected as **active**.

Only techniques belonging to active Books are shown in the main Technique List.

Selecting multiple Books combines their techniques.

This allows workflows such as:

> Show me everything from JJU and my gym curriculum, but temporarily ignore my experimental no-gi collection.

The Book selection is a view preference and does not alter or delete any stored data.

There should also be:

* Select all
* Select none

---

# 8. Search

A search field should filter techniques by text.

Search should match at minimum:

* Technique name
* Chapter name
* Book name

Searching notes may be added later.

Search combines with all other filters.

Example:

```text
Search: "guard"

Books:
✓ JJU
✓ My No-Gi Game

Read: Yes
Drilled: Yes
Sparred: <3
```

The resulting list should satisfy all active conditions.

---

# 9. Filtering

The application should provide flexible filtering rather than a fixed collection of preset views.

Filters include:

## Read

* Any
* Read
* Not Read

## Drilled

* Any
* Drilled
* Not Drilled

## Sparring

* Any
* 0
* 1
* 2
* 3
* Less than 3

## Archived

Default:

* Hide archived

Options:

* Hide archived
* Show archived
* Archived only

Filters should combine.

Examples:

### Techniques I understand but haven't practised

Read: Yes
Drilled: No

### Techniques I have drilled but cannot yet reliably use

Drilled: Yes
Sparred: Less than 3

### Techniques ready for live experimentation

Read: Yes
Drilled: Yes
Sparred: 0

### Fully progressed techniques

Sparred: 3

---

# 10. Sorting

The list should support sorting by:

* Default Book/Chapter order
* Technique name
* Sparring count ascending
* Sparring count descending
* Read status
* Drilled status

A particularly important workflow is:

> Show all techniques that are Read and Drilled, ordered by least Sparred.

Configuration:

```text
Read: Yes
Drilled: Yes
Sort: Sparring count ascending
```

Results with zero sparring successes therefore appear first.

---

# 11. Archiving

Any Technique can be archived.

Archiving:

* preserves all data;
* removes the technique from normal views;
* excludes it from default searches and filters;
* can be reversed.

Reasons might include:

* technique no longer relevant;
* duplicate entry;
* user has deliberately stopped training it;
* source has been reorganised.

Archive should be preferred to deletion for normal use.

Permanent deletion can still be available through an explicit destructive action.

---

# 12. Creating Content

## 12.1 Create Book

The user can create a Book with:

* Name
* Optional description

Example:

```text
Name: ADCC Study
Description: No-gi material I want to experiment with
```

---

## 12.2 Create Chapter

Within a Book:

```text
Chapter name: Butterfly Guard
```

The Chapter may subsequently be renamed or reordered.

---

## 12.3 Create Technique

Within a Chapter:

```text
Technique name: Shoulder Crunch Butterfly Sweep
```

Optional fields can immediately include:

* Notes
* Links
* Read
* Drilled
* Sparring count

---

# 13. Managing Books

The Book management screen should allow:

* Add Book
* Rename Book
* Delete Book
* Archive/hide Book if desired
* Reorder Books
* Import Book
* Export individual Book
* Add Chapter
* Rename Chapter
* Delete Chapter
* Reorder Chapters
* Add Technique
* Move Technique to another Chapter
* Move Technique to another Book

Destructive operations should require confirmation.

---

# 14. External Book Imports

Curated material such as a JJU index should exist outside the main application as an importable JSON file.

Example:

```json
{
  "schemaVersion": 1,
  "type": "book",
  "book": {
    "externalId": "jju",
    "name": "Jiu-Jitsu University",
    "version": "1.0",
    "chapters": [
      {
        "externalId": "survival",
        "name": "Survival",
        "techniques": [
          {
            "externalId": "technique-example-1",
            "name": "Example Technique"
          }
        ]
      }
    ]
  }
}
```

Imported source files define organisational structure.

User-specific state should remain separate.

For example, the imported source may say:

```text
Technique:
flower-sweep
```

while the user's local database says:

```text
flower-sweep:
Read = true
Drilled = true
Sparred = 2
Notes = "Outside foot externally rotated..."
```

This separation is important for robust source updating.

---

# 15. Robust Source Updates

Imported Books may change over time.

For example:

```text
JJU index version 1.0
↓
JJU index version 1.1
```

An updated source might:

* add techniques;
* rename techniques;
* add chapters;
* rename chapters;
* move techniques between chapters;
* remove obsolete entries.

User progress must survive these changes.

Therefore imported entities require stable identifiers.

Example:

```json
{
  "externalId": "flower-sweep",
  "name": "Flower Sweep"
}
```

If a later import changes the visible name to:

```json
{
  "externalId": "flower-sweep",
  "name": "Flower / Pendulum Sweep"
}
```

the application should recognise that this is the same technique and retain:

* Read status
* Drilled status
* Sparring count
* Notes
* Links
* Archive status

Do not use the visible technique name as the primary identifier.

---

# 16. Handling Removed Source Items

If an updated imported Book no longer contains a technique for which the user has progress or notes, that data must not simply disappear.

Possible behaviour:

1. mark the technique as **orphaned from source**;
2. preserve the complete user record;
3. allow the user to:

   * keep it;
   * move it elsewhere;
   * archive it;
   * delete it.

Example:

```text
Flower Sweep Variation

Source status:
No longer present in JJU import

Your data:
Read ✓
Drilled ✓
Sparred ●●○
Notes present
```

This protects user-created information from source updates.

---

# 17. Data Separation

The internal data model should distinguish between:

## Source data

Information supplied by a Book definition:

* Book name
* Chapter names
* Technique names
* Structure
* Stable IDs

## User data

Information belonging to the user:

* Read
* Drilled
* Sparring successes
* Notes
* Links
* Archived
* Custom additions

Source imports must never silently overwrite user data.

---

# 18. Custom Content and Imported Content

User-created Books behave identically to imported Books in the normal interface.

The distinction is only relevant internally.

For example:

```text
Jiu-Jitsu University
Source: Imported

My ADCC Stuff
Source: User-created
```

The Technique List and filters should treat them identically.

---

# 19. Export and Backup

The entire application database must be exportable as JSON.

Example filename:

```text
bjj-tracker-backup-2026-09-18.json
```

The backup should include:

* Books
* Chapters
* Techniques
* Progress
* Notes
* Links
* Archives
* Source metadata
* Application schema version

A complete backup should be sufficient to recreate the user's application state on another installation.

---

# 20. Import / Restore

The application should support two distinct import functions.

## Import Book

Imports a new or updated source definition.

Example:

```text
jju.json
```

This should merge against existing source IDs and preserve user progress.

## Restore Backup

Imports a complete application backup.

The application should validate:

* JSON syntax
* schema version
* required identifiers
* duplicate IDs
* malformed data

Before overwriting existing data, the interface should clearly state what will happen.

Ideally the user can choose:

* Replace current database
* Merge with current database

---

# 21. Schema Versioning

Every export/import format must have a schema version.

Example:

```json
{
  "schemaVersion": 1
}
```

Future versions of the application must migrate older data rather than simply rejecting it whenever reasonably possible.

The application should never assume that the current data structure will remain unchanged forever.

---

# 22. Persistence

For the initial web application, data should be local-first.

Recommended storage:

**IndexedDB**

rather than localStorage.

Reasons:

* structured data;
* considerably more capacity;
* better suited to backup/import;
* easier future schema migration;
* robust storage for large notes collections.

No account or server should be necessary for the first version.

---

# 23. Technique Detail Screen

Opening a Technique should show:

```text
Flower Sweep

Jiu-Jitsu University
Closed Guard

[✓] Read

[✓] Drilled

Sparred
[●] [●] [○]

Notes
────────────────────────

Make sure outside foot is externally rotated.

Raise towards armpit.

────────────────────────

Links

Flower sweep detail
youtube.com/...

Useful reel
instagram.com/...

+ Add Link

Archive Technique
```

Changes should save automatically.

---

# 24. Quick Progress Editing

Progress should also be editable directly from the Technique List.

Example:

```text
Flower Sweep

Read ✓   Drilled ✓   Sparred ●●○
```

Clicking the third sparring marker should immediately move it to:

```text
Sparred ●●●
```

The user should not need to open a separate edit form merely to record something achieved during a class.

---

# 25. Mobile Usability

Although implemented as a web application, the interface should be designed primarily for phone use.

Likely use cases include:

* checking techniques immediately before BJJ;
* marking something drilled during a class;
* recording a successful technique after rolling;
* pasting a useful YouTube or Instagram link.

Requirements:

* large touch targets;
* no reliance on hover;
* responsive layout;
* fast loading;
* installable as a PWA later if desired.

---

# 26. Main Navigation

A minimal navigation model is preferred.

Suggested structure:

```text
Techniques
Books
Backup
```

## Techniques

Primary search/filter/progress screen.

## Books

Manage sources, chapters and techniques.

## Backup

Import/export/restore controls.

The application should avoid unnecessary dashboards and gamification.

---

# 27. Filter State

Filter and sorting preferences should persist between sessions.

For example, if the user commonly uses:

```text
Books:
✓ JJU
✓ Gym Curriculum

Read: Yes
Drilled: Yes
Sparred: <3

Sort:
Least sparred first
```

the application should reopen with this view rather than resetting everything.

There should be an obvious **Clear Filters** action.

---

# 28. Optional Filter Presets

A later feature could allow saved searches.

Examples:

### Need to Drill

```text
Read = Yes
Drilled = No
```

### Try in Rolling

```text
Drilled = Yes
Sparred < 3
Sort = Sparred ascending
```

### Established

```text
Sparred = 3
```

These should be user-defined rather than hard-coded into the underlying data model.

---

# 29. Suggested Data Model

Conceptually:

```text
Book
 ├── id
 ├── externalId?
 ├── sourceType
 ├── sourceVersion?
 ├── name
 ├── description?
 └── ordering

Chapter
 ├── id
 ├── externalId?
 ├── bookId
 ├── name
 └── ordering

Technique
 ├── id
 ├── externalId?
 ├── chapterId
 ├── name
 ├── read
 ├── drilled
 ├── sparringSuccesses
 ├── notesMarkdown
 ├── archived
 ├── sourceStatus
 └── ordering

TechniqueLink
 ├── id
 ├── techniqueId
 ├── title?
 └── url
```

The exact database representation can differ, but these concepts should remain separate.

---

# 30. Stable IDs

Every Book, Chapter and Technique must have an immutable internal UUID.

Imported material should additionally have a stable external identifier.

Example:

```text
internal id:
550e8400-e29b-41d4-a716-446655440000

external id:
jju:closed-guard:flower-sweep
```

The internal UUID identifies the local record.

The external ID allows future versions of an imported Book to identify the same conceptual item.

Names are display properties and may safely change.

---

# 31. Import Conflict Behaviour

If an imported source contains an external ID already present locally:

* update source-controlled metadata;
* preserve user-controlled metadata.

Example:

The source may update:

```text
Flower Sweep
```

to:

```text
Pendulum / Flower Sweep
```

The application updates the displayed name.

It must preserve:

```text
Read ✓
Drilled ✓
Sparred 2
Notes
Links
Archive state
```

If an import creates an ambiguous or invalid conflict, the import should stop and show the user the problem rather than silently modifying unrelated data.

---

# 32. MVP Scope

The first useful release should contain:

1. Book management
2. Chapter management
3. Technique management
4. Read checkbox
5. Drilled checkbox
6. Three-step Sparred tracker
7. Markdown notes
8. Technique links
9. Archive functionality
10. Active Book selection
11. Text search
12. Read filtering
13. Drilled filtering
14. Sparring-count filtering
15. Sorting by sparring count
16. Full JSON backup
17. Full JSON restore
18. External Book JSON import
19. Stable imported-source IDs
20. IndexedDB persistence

This is enough for the application to be genuinely useful without requiring accounts, servers or cloud infrastructure.

---

# 33. Explicitly Out of Scope for MVP

The first release does not need:

* belt progression;
* points or XP;
* win/loss records;
* social features;
* instructor accounts;
* video hosting;
* automatic technique recognition;
* AI-generated technique instruction;
* cloud accounts;
* synchronisation;
* class attendance tracking;
* competition records.

These can be reconsidered after the basic tracking workflow has proven useful.

---

# 34. Core Product Principle

The application should answer the question:

> What have I encountered, what have I actually practised, and what do I now need to make work against resistance?

The most important view is therefore likely to become:

```text
Read ✓
Drilled ✓
Sparred < 3
Sort: least sparred first
```

This turns passive BJJ study into a queue of techniques to deliberately practise during live training.
