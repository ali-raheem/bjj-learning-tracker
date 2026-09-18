<script lang="ts">
  import { data } from './data.svelte';
  import { prefs } from './prefs.svelte';
  import { href } from './router.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const books = $derived(data.books.filter((b) => !b.hidden));
</script>

<div class="card menu">
  <div class="row between">
    <strong>Books</strong>
    <div class="row">
      <button type="button" class="small ghost" onclick={() => prefs.selectAll()}>All</button>
      <button
        type="button"
        class="small ghost"
        onclick={() => prefs.selectNone(books.map((b) => b.id))}>None</button
      >
      <button type="button" class="small ghost" aria-label="Close" onclick={onclose}>✕</button>
    </div>
  </div>
  {#if books.length === 0}
    <p class="muted">No Books yet.</p>
  {/if}
  {#each books as book (book.id)}
    <label class="check">
      <input
        type="checkbox"
        checked={prefs.isActive(book.id)}
        onchange={(e) => prefs.setActive(book.id, e.currentTarget.checked)}
      />
      <span class="grow truncate">{book.name}</span>
    </label>
  {/each}
  <div class="row" style="margin-top:8px">
    <a class="btn small" href={href('books')}>+ Add Book</a>
    <a class="btn small ghost" href={href('books')}>Manage Books</a>
  </div>
</div>

<style>
  .menu {
    margin-top: 4px;
  }
</style>
