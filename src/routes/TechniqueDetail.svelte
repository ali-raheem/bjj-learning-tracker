<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { repo } from '../lib/db/repo';
  import { data } from '../lib/ui/data.svelte';
  import { confirmAction, errorMessage } from '../lib/ui/files';
  import { renderMarkdown } from '../lib/ui/markdown';
  import ProgressRow from '../lib/ui/ProgressRow.svelte';
  import { back, href, navigate } from '../lib/ui/router.svelte';

  let { id }: { id: string } = $props();

  const technique = $derived(data.technique(id));
  const chapter = $derived(data.chapter(technique?.chapterId));
  const book = $derived(data.book(chapter?.bookId));

  // Local editing state, seeded once per technique so live updates never clobber typing.
  let loadedId: string | null = null;
  let name = $state('');
  let notes = $state('');
  let preview = $state(false);
  let error = $state('');
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let dirtyNotes = false;

  $effect(() => {
    const t = technique;
    if (t && t.id !== loadedId) {
      loadedId = t.id;
      untrack(() => {
        name = t.name;
        notes = t.notesMarkdown;
        preview = t.notesMarkdown.trim() !== '';
      });
    }
  });

  function scheduleNotesSave() {
    dirtyNotes = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushNotes, 500);
  }
  async function flushNotes() {
    clearTimeout(saveTimer);
    if (!dirtyNotes || !technique) return;
    dirtyNotes = false;
    try {
      await repo.updateTechnique(technique.id, { notesMarkdown: notes });
    } catch (e) {
      error = errorMessage(e);
    }
  }
  onDestroy(() => void flushNotes());

  async function saveName() {
    if (!technique) return;
    const clean = name.trim();
    if (!clean) {
      name = technique.name;
      return;
    }
    if (clean === technique.name) return;
    try {
      await repo.updateTechnique(technique.id, { name: clean });
    } catch (e) {
      error = errorMessage(e);
    }
  }

  // Links
  let newUrl = $state('');
  let newTitle = $state('');
  let editingLink = $state<string | null>(null);
  let editUrl = $state('');
  let editTitle = $state('');

  async function addLink() {
    if (!technique) return;
    try {
      await repo.addLink(technique.id, { url: newUrl, title: newTitle });
      newUrl = '';
      newTitle = '';
    } catch (e) {
      error = errorMessage(e);
    }
  }
  function startEdit(l: { id: string; url: string; title?: string }) {
    editingLink = l.id;
    editUrl = l.url;
    editTitle = l.title ?? '';
  }
  async function saveEdit() {
    if (!technique || !editingLink) return;
    try {
      await repo.updateLink(technique.id, editingLink, {
        url: editUrl.trim(),
        title: editTitle.trim(),
      });
      editingLink = null;
    } catch (e) {
      error = errorMessage(e);
    }
  }
  async function removeLink(linkId: string) {
    if (!technique || !confirmAction('Delete this link?')) return;
    await repo.removeLink(technique.id, linkId);
  }

  // Move / archive / delete
  const moveTargets = $derived(
    data.books
      .slice()
      .sort((a, b) => a.ordering - b.ordering)
      .map((b) => ({ book: b, chapters: data.chaptersOf(b.id) }))
      .filter((x) => x.chapters.length > 0),
  );
  async function move(e: Event) {
    const select = e.currentTarget as HTMLSelectElement;
    const target = select.value;
    select.value = '';
    if (!technique || !target || target === technique.chapterId) return;
    const dest = data.chapter(target);
    const crossBook = dest && dest.bookId !== technique.bookId;
    const warning =
      crossBook && technique.sourceStatus !== 'user'
        ? '\n\nThis moves it out of its source Book, so future imports of that source will no longer update it.'
        : '';
    if (!confirmAction(`Move "${technique.name}" to ${dest?.name}?${warning}`)) return;
    try {
      await repo.moveTechnique(technique.id, target);
    } catch (err) {
      error = errorMessage(err);
    }
  }
  async function toggleArchive() {
    if (!technique) return;
    await repo.setArchived(technique.id, !technique.archived);
  }
  async function remove() {
    if (!technique) return;
    if (
      !confirmAction(
        `Permanently delete "${technique.name}" and its notes and links? This cannot be undone.`,
      )
    )
      return;
    await repo.deleteTechnique(technique.id);
    navigate('');
  }
</script>

{#if !technique}
  <div class="empty">
    <p>Technique not found.</p>
    <a class="btn" href={href('')}>Back to techniques</a>
  </div>
{:else}
  <div class="row nowrap">
    <button type="button" class="ghost icon" aria-label="Back" onclick={() => back('')}>←</button>
    <span class="muted truncate grow">
      {#if book}<a href={href(`books/${book.id}`)}>{book.name}</a>{/if}
      {#if chapter}· {chapter.name}{/if}
    </span>
  </div>

  <input
    type="text"
    class="title"
    bind:value={name}
    onblur={saveName}
    onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    aria-label="Technique name"
  />

  {#if technique.sourceStatus === 'orphaned'}
    <div class="notice">
      <strong>No longer in the source.</strong> The latest import of “{book?.name}” does not include
      this technique. Your progress and notes are kept. You can leave it here, move it, archive it
      or delete it.
    </div>
  {/if}
  {#if technique.archived}
    <div class="notice">This technique is archived and hidden from normal views.</div>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="card">
    <ProgressRow {technique} large />
  </div>

  <div class="row between">
    <h2 style="margin:12px 0 4px">Notes</h2>
    <button type="button" class="small ghost" onclick={() => (preview = !preview)}>
      {preview ? 'Edit' : 'Preview'}
    </button>
  </div>
  {#if preview}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised by DOMPurify -->
    <div
      class="card markdown"
      role="button"
      tabindex="0"
      onclick={() => (preview = false)}
      onkeydown={(e) => e.key === 'Enter' && (preview = false)}
    >
      {#if notes.trim()}
        {@html renderMarkdown(notes)}
      {:else}
        <span class="muted">No notes yet. Tap to add some.</span>
      {/if}
    </div>
  {:else}
    <textarea
      bind:value={notes}
      oninput={scheduleNotesSave}
      onblur={flushNotes}
      placeholder="Plain text or Markdown. Saved automatically."
      aria-label="Notes"
    ></textarea>
  {/if}

  <h2>Links</h2>
  <ul class="list-plain">
    {#each technique.links as l (l.id)}
      <li class="link-row">
        {#if editingLink === l.id}
          <div class="grow stack">
            <input type="url" bind:value={editUrl} placeholder="https://…" aria-label="URL" />
            <input
              type="text"
              bind:value={editTitle}
              placeholder="Title (optional)"
              aria-label="Title"
            />
            <div class="row">
              <button type="button" class="small primary" onclick={saveEdit}>Save</button>
              <button type="button" class="small ghost" onclick={() => (editingLink = null)}
                >Cancel</button
              >
            </div>
          </div>
        {:else}
          <a class="text" href={l.url} target="_blank" rel="noopener noreferrer">
            <span class="title">{l.title || l.url}</span>
            {#if l.title}<span class="url">{l.url}</span>{/if}
          </a>
          <button
            type="button"
            class="icon small ghost"
            aria-label="Edit link"
            onclick={() => startEdit(l)}>✎</button
          >
          <button
            type="button"
            class="icon small ghost"
            aria-label="Delete link"
            onclick={() => removeLink(l.id)}>🗑</button
          >
        {/if}
      </li>
    {/each}
  </ul>
  <form
    class="stack"
    style="margin-top:8px"
    onsubmit={(e) => {
      e.preventDefault();
      addLink();
    }}
  >
    <input
      type="url"
      bind:value={newUrl}
      placeholder="Paste a link (https://…)"
      aria-label="New link URL"
      required
    />
    <input
      type="text"
      bind:value={newTitle}
      placeholder="Title (optional)"
      aria-label="New link title"
    />
    <button type="submit" class="small" disabled={!newUrl.trim()}>+ Add Link</button>
  </form>

  <h2>Manage</h2>
  <div class="stack">
    <label class="field">
      <span>Move to chapter</span>
      <select onchange={move} aria-label="Move to chapter">
        <option value="">Choose a chapter…</option>
        {#each moveTargets as g (g.book.id)}
          <optgroup label={g.book.name}>
            {#each g.chapters as c (c.id)}
              <option value={c.id} disabled={c.id === technique.chapterId}>{c.name}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </label>
    <div class="row">
      <button type="button" onclick={toggleArchive}>
        {technique.archived ? 'Unarchive Technique' : 'Archive Technique'}
      </button>
      <button type="button" class="danger" onclick={remove}>Delete permanently</button>
    </div>
  </div>
{/if}

<style>
  input.title {
    font-size: 1.35rem;
    font-weight: 600;
    margin: 8px 0;
  }
</style>
