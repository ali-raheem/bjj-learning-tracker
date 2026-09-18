<script lang="ts">
  import { repo } from '../lib/db/repo';
  import { BOOK_FILE_ACCEPT, parseAnyBookFile } from '../lib/import/anyBook';
  import { importBook, type BookImportSummary } from '../lib/import/bookImport';
  import { ImportError } from '../lib/import/validation';
  import { progressStats } from '../lib/model/filter';
  import { data } from '../lib/ui/data.svelte';
  import { confirmAction, errorMessage, pickFile } from '../lib/ui/files';
  import { href } from '../lib/ui/router.svelte';

  let showAdd = $state(false);
  let newName = $state('');
  let newDesc = $state('');
  let error = $state('');
  let problems = $state<string[]>([]);
  let summary = $state<BookImportSummary | null>(null);

  const books = $derived(data.books.slice().sort((a, b) => a.ordering - b.ordering));

  function summaryLine(c: { total: number; done: number; pct: number }) {
    const parts = [`${c.total} technique${c.total === 1 ? '' : 's'}`, `${c.done} working`];
    if (c.total > 0) parts.push(`${c.pct}% complete`);
    return parts.join(' · ');
  }

  function counts(bookId: string) {
    const ts = data.techniques.filter((t) => t.bookId === bookId && !t.archived);
    const s = progressStats(ts);
    return {
      total: ts.length,
      done: ts.filter((t) => t.sparringSuccesses >= 3).length,
      pct: s.overall,
    };
  }

  async function addBook() {
    error = '';
    try {
      await repo.createBook({ name: newName, description: newDesc });
      newName = '';
      newDesc = '';
      showAdd = false;
    } catch (e) {
      error = errorMessage(e);
    }
  }

  async function moveBook(id: string, dir: -1 | 1) {
    const ids = books.map((b) => b.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await repo.reorderBooks(ids);
  }

  async function doImport() {
    error = '';
    problems = [];
    summary = null;
    const file = await pickFile(BOOK_FILE_ACCEPT);
    if (!file) return;
    try {
      const parsed = parseAnyBookFile(await file.text(), file.name);
      const existing = data.books.find((b) => b.externalId === parsed.book.externalId);
      const n = parsed.book.chapters.reduce((s, c) => s + c.techniques.length, 0);
      const msg = existing
        ? `Update “${existing.name}” from this file (${n} techniques)? Your progress, notes and links are kept.`
        : `Import “${parsed.book.name}” (${parsed.book.chapters.length} chapters, ${n} techniques)?`;
      if (!confirmAction(msg)) return;
      summary = await importBook(parsed);
    } catch (e) {
      if (e instanceof ImportError) {
        error = e.summary;
        problems = e.problems;
      } else error = errorMessage(e);
    }
  }
</script>

<h1>Books</h1>

<div class="row">
  <button type="button" class="primary" onclick={() => (showAdd = !showAdd)}>+ Add Book</button>
  <button type="button" onclick={doImport}>Import Book file</button>
</div>

{#if showAdd}
  <form
    class="card"
    onsubmit={(e) => {
      e.preventDefault();
      addBook();
    }}
  >
    <label class="field"><span>Name</span><input type="text" bind:value={newName} required /></label
    >
    <label class="field"
      ><span>Description (optional)</span><input type="text" bind:value={newDesc} /></label
    >
    <div class="row">
      <button type="submit" class="primary" disabled={!newName.trim()}>Create</button>
      <button type="button" class="ghost" onclick={() => (showAdd = false)}>Cancel</button>
    </div>
  </form>
{/if}

{#if error}
  <div class="notice danger" role="alert">
    <strong>{error}</strong>
    {#if problems.length}<pre class="problems">{problems.join('\n')}</pre>{/if}
  </div>
{/if}
{#if summary}
  <div class="card success">
    {summary.createdBook ? 'Imported' : 'Updated'} “{summary.bookName}”:
    {summary.techniquesAdded} added, {summary.techniquesUpdated} updated,
    {summary.techniquesOrphaned} orphaned, {summary.techniquesRemoved} removed.
  </div>
{/if}

{#if books.length === 0}
  <div class="empty">No Books yet. Create one or import a Book file.</div>
{/if}

<ul class="list-plain">
  {#each books as b, i (b.id)}
    {@const c = counts(b.id)}
    <li class="card row nowrap">
      <a
        class="grow"
        href={href(`books/${b.id}`)}
        style="text-decoration:none;color:inherit;min-width:0"
      >
        <div class="row nowrap">
          <strong class="truncate">{b.name}</strong>
          {#if b.hidden}<span class="badge">hidden</span>{/if}
          {#if b.sourceType === 'imported'}<span class="badge"
              >imported{b.sourceVersion ? ` v${b.sourceVersion}` : ''}</span
            >{/if}
        </div>
        {#if b.description}<div class="muted small truncate">{b.description}</div>{/if}
        <div class="muted small">{summaryLine(c)}</div>
      </a>
      <div class="stack" style="gap:2px">
        <button
          type="button"
          class="icon small ghost"
          aria-label="Move up"
          disabled={i === 0}
          onclick={() => moveBook(b.id, -1)}>▲</button
        >
        <button
          type="button"
          class="icon small ghost"
          aria-label="Move down"
          disabled={i === books.length - 1}
          onclick={() => moveBook(b.id, 1)}>▼</button
        >
      </div>
    </li>
  {/each}
</ul>
