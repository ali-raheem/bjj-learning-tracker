<script lang="ts">
  import {
    applyFilters,
    groupByChapter,
    isDefaultFilters,
    joinRows,
    PRESET_STAT,
    PRESETS,
    progressStats,
    sortRows,
  } from '../lib/model/filter';
  import { loadExampleBook } from '../lib/import/example';
  import BookMenu from '../lib/ui/BookMenu.svelte';
  import { data } from '../lib/ui/data.svelte';
  import { errorMessage } from '../lib/ui/files';
  import FilterPanel from '../lib/ui/FilterPanel.svelte';
  import { prefs } from '../lib/ui/prefs.svelte';
  import ProgressRow from '../lib/ui/ProgressRow.svelte';
  import { href } from '../lib/ui/router.svelte';

  let showFilters = $state(false);
  let showBooks = $state(false);

  const visibleBooks = $derived(data.books.filter((b) => !b.hidden));
  const activeIds = $derived(
    new Set(visibleBooks.filter((b) => prefs.isActive(b.id)).map((b) => b.id)),
  );
  const rows = $derived(joinRows(data.techniques, data.chapters, data.books));
  const filtered = $derived(
    sortRows(applyFilters(rows, prefs.filters, activeIds), prefs.filters.sort),
  );
  const groups = $derived(groupByChapter(filtered));
  const filtersActive = $derived(!isDefaultFilters({ ...prefs.filters, search: '' }));
  const showBookName = $derived(activeIds.size > 1);
  /** Completion over non-archived techniques in the active Books, ignoring search and filters. */
  const stats = $derived(
    progressStats(data.techniques.filter((t) => !t.archived && activeIds.has(t.bookId))),
  );

  function establishedCount(chapterId: string) {
    const ts = data.techniquesOf(chapterId).filter((t) => !t.archived);
    return { done: ts.filter((t) => t.sparringSuccesses >= 3).length, total: ts.length };
  }

  let loadingExample = $state(false);
  let exampleError = $state('');
  async function addExample() {
    loadingExample = true;
    exampleError = '';
    try {
      await loadExampleBook();
    } catch (e) {
      exampleError = errorMessage(e);
    } finally {
      loadingExample = false;
    }
  }
</script>

<div class="toolbar">
  <div class="row nowrap">
    <input
      type="search"
      class="grow"
      placeholder="Search techniques, chapters, books"
      bind:value={prefs.filters.search}
      aria-label="Search"
    />
    <button
      type="button"
      class="icon"
      class:primary={filtersActive}
      aria-label="Filters"
      aria-expanded={showFilters}
      onclick={() => {
        showFilters = !showFilters;
        showBooks = false;
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"><path d="M3 5h18l-7 8v6l-4 2v-8z" /></svg
      >
    </button>
    <button
      type="button"
      class="icon"
      class:primary={activeIds.size !== visibleBooks.length}
      aria-label="Books"
      aria-expanded={showBooks}
      onclick={() => {
        showBooks = !showBooks;
        showFilters = false;
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        ><path
          d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"
        /></svg
      >
    </button>
  </div>
  {#if showFilters}
    <FilterPanel onclose={() => (showFilters = false)} />
  {/if}
  {#if showBooks}
    <BookMenu onclose={() => (showBooks = false)} />
  {/if}
  <div class="row presets" role="group" aria-label="Quick filters">
    {#each PRESETS as p (p.id)}
      {@const fill = stats[PRESET_STAT[p.id] ?? 'read']}
      <button
        type="button"
        class="chip small stat"
        class:on={prefs.presetActive(p)}
        aria-pressed={prefs.presetActive(p)}
        style="--fill: {fill}%"
        title="{fill}% done"
        onclick={() => prefs.togglePreset(p)}
      >
        {p.label}
        <span class="pct">{fill}%</span>
      </button>
    {/each}
  </div>
</div>

{#if data.books.length === 0}
  <div class="empty">
    <p>No Books yet.</p>
    <p><a class="btn primary" href={href('books')}>Add or import a Book</a></p>
    <p class="muted small">or</p>
    <p>
      <button type="button" onclick={addExample} disabled={loadingExample}>
        {loadingExample ? 'Loading…' : 'Load example Book'}
      </button>
    </p>
    {#if exampleError}<p class="error">{exampleError}</p>{/if}
  </div>
{:else if activeIds.size === 0}
  <div class="empty">
    <p>No Books selected.</p>
    <button type="button" onclick={() => prefs.selectAll()}>Select all Books</button>
  </div>
{:else if filtered.length === 0}
  <div class="empty">
    <p>No techniques match.</p>
    {#if filtersActive || prefs.filters.search}
      <button type="button" onclick={() => prefs.clearFilters()}>Clear filters</button>
    {/if}
  </div>
{:else}
  <p class="muted small" aria-live="polite">
    {filtered.length} technique{filtered.length === 1 ? '' : 's'}
    {#if filtersActive}· filtered{/if}
    {#if stats.total > 0}· {stats.overall}% complete{/if}
  </p>
  {#each groups as g (g.chapter.id)}
    {@const est = establishedCount(g.chapter.id)}
    <div class="group-head">
      <h3 style="margin:0">{g.chapter.name}</h3>
      {#if showBookName}<span class="book">{g.book.name}</span>{/if}
      {#if est.total > 0}<span class="muted small">{est.done}/{est.total} working</span>{/if}
      {#if g.chapter.sourceStatus === 'orphaned'}<span class="badge warn">not in source</span>{/if}
    </div>
    {#each g.rows as r (r.technique.id)}
      <div class="tech-row">
        <a
          class="name"
          class:archived={r.technique.archived}
          href={href(`technique/${r.technique.id}`)}
        >
          <span class="grow">{r.technique.name}</span>
          {#if r.technique.sourceStatus === 'orphaned'}<span class="badge warn">orphaned</span>{/if}
          {#if r.technique.archived}<span class="badge">archived</span>{/if}
          <span class="muted">›</span>
        </a>
        <ProgressRow technique={r.technique} />
      </div>
    {/each}
  {/each}
{/if}

<style>
  .presets {
    margin-top: 8px;
  }
  .chip.stat {
    background: linear-gradient(90deg, var(--fill-color) var(--fill), transparent var(--fill));
    --fill-color: var(--accent-soft);
  }
  .chip.stat.on {
    --fill-color: var(--ok-soft);
    background-color: transparent;
  }
  .pct {
    font-size: 0.75rem;
    opacity: 0.8;
  }
</style>
