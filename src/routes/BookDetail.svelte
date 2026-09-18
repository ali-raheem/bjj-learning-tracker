<script lang="ts">
  import { untrack } from 'svelte';
  import { repo } from '../lib/db/repo';
  import { exportBook } from '../lib/import/bookImport';
  import { data } from '../lib/ui/data.svelte';
  import {
    confirmAction,
    downloadJson,
    errorMessage,
    promptText,
    safeFilename,
  } from '../lib/ui/files';
  import { back, href, navigate } from '../lib/ui/router.svelte';

  let { id }: { id: string } = $props();
  const book = $derived(data.book(id));
  const chapters = $derived(data.chaptersOf(id));

  let loadedId: string | null = null;
  let name = $state('');
  let description = $state('');
  let error = $state('');
  let newChapter = $state('');
  let newTechnique = $state<Record<string, string>>({});

  $effect(() => {
    const b = book;
    if (b && b.id !== loadedId) {
      loadedId = b.id;
      untrack(() => {
        name = b.name;
        description = b.description ?? '';
      });
    }
  });

  async function saveMeta() {
    if (!book) return;
    if (!name.trim()) {
      name = book.name;
      return;
    }
    if (name.trim() === book.name && description.trim() === (book.description ?? '')) return;
    try {
      await repo.updateBook(book.id, { name, description });
    } catch (e) {
      error = errorMessage(e);
    }
  }
  async function toggleHidden() {
    if (book) await repo.updateBook(book.id, { hidden: !book.hidden });
  }
  async function deleteBook() {
    if (!book) return;
    const n = data.techniques.filter((t) => t.bookId === book.id).length;
    if (
      !confirmAction(
        `Delete “${book.name}” and all ${n} techniques in it, including your notes and progress? This cannot be undone.`,
      )
    )
      return;
    await repo.deleteBook(book.id);
    navigate('books');
  }
  async function doExport() {
    if (!book) return;
    downloadJson(await exportBook(book.id), `${safeFilename(book.name)}.json`);
  }

  async function addChapter() {
    if (!book) return;
    try {
      await repo.createChapter(book.id, newChapter);
      newChapter = '';
    } catch (e) {
      error = errorMessage(e);
    }
  }
  async function renameChapter(c: { id: string; name: string }) {
    const v = promptText('Chapter name', c.name);
    if (v === null || !v.trim()) return;
    await repo.renameChapter(c.id, v);
  }
  async function deleteChapter(c: { id: string; name: string }) {
    if (!book) return;
    const n = data.techniques.filter((t) => t.chapterId === c.id).length;
    if (
      !confirmAction(`Delete chapter “${c.name}” and its ${n} techniques? This cannot be undone.`)
    )
      return;
    await repo.deleteChapter(c.id);
  }
  async function moveChapter(cid: string, dir: -1 | 1) {
    if (!book) return;
    const ids = chapters.map((c) => c.id);
    const i = ids.indexOf(cid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await repo.reorderChapters(book.id, ids);
  }

  async function addTechnique(chapterId: string) {
    const n = newTechnique[chapterId] ?? '';
    try {
      await repo.createTechnique(chapterId, { name: n });
      newTechnique[chapterId] = '';
    } catch (e) {
      error = errorMessage(e);
    }
  }
  async function moveTechnique(tid: string, chapterId: string, dir: -1 | 1) {
    const ids = data.techniquesOf(chapterId).map((t) => t.id);
    const i = ids.indexOf(tid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await repo.reorderTechniques(chapterId, ids);
  }
</script>

{#if !book}
  <div class="empty">
    <p>Book not found.</p>
    <a class="btn" href={href('books')}>Back to Books</a>
  </div>
{:else}
  <div class="row nowrap">
    <button type="button" class="ghost icon" aria-label="Back" onclick={() => back('books')}
      >←</button
    >
    <span class="muted grow">
      {book.sourceType === 'imported' ? 'Imported Book' : 'Your Book'}
      {#if book.sourceVersion}· version {book.sourceVersion}{/if}
    </span>
  </div>

  <label class="field">
    <span>Name</span>
    <input type="text" bind:value={name} onblur={saveMeta} aria-label="Book name" />
  </label>
  <label class="field">
    <span>Description</span>
    <input type="text" bind:value={description} onblur={saveMeta} aria-label="Book description" />
  </label>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="row">
    <button type="button" onclick={toggleHidden}>{book.hidden ? 'Unhide Book' : 'Hide Book'}</button
    >
    <button type="button" onclick={doExport}>Export Book file</button>
    <button type="button" class="danger" onclick={deleteBook}>Delete Book</button>
  </div>
  {#if book.hidden}
    <p class="muted small">Hidden Books are left out of the Books menu and the technique list.</p>
  {/if}
  {#if book.sourceType === 'imported'}
    <p class="muted small">
      Re-import an updated file for this source from the Books screen; names and structure update
      while your progress is kept.
    </p>
  {/if}

  <h2>Chapters</h2>
  {#each chapters as c, ci (c.id)}
    {@const techniques = data.techniquesOf(c.id)}
    <div class="card">
      <div class="row nowrap">
        <strong class="grow truncate">{c.name}</strong>
        {#if c.sourceStatus === 'orphaned'}<span class="badge warn">not in source</span>{/if}
        <button
          type="button"
          class="icon small ghost"
          aria-label="Move chapter up"
          disabled={ci === 0}
          onclick={() => moveChapter(c.id, -1)}>▲</button
        >
        <button
          type="button"
          class="icon small ghost"
          aria-label="Move chapter down"
          disabled={ci === chapters.length - 1}
          onclick={() => moveChapter(c.id, 1)}>▼</button
        >
        <button
          type="button"
          class="icon small ghost"
          aria-label="Rename chapter"
          onclick={() => renameChapter(c)}>✎</button
        >
        <button
          type="button"
          class="icon small ghost"
          aria-label="Delete chapter"
          onclick={() => deleteChapter(c)}>🗑</button
        >
      </div>
      <ul class="list-plain">
        {#each techniques as t, ti (t.id)}
          <li class="row nowrap" style="padding:4px 0">
            <a
              class="grow truncate"
              href={href(`technique/${t.id}`)}
              style="color:inherit;text-decoration:none;min-height:40px;display:flex;align-items:center;gap:6px"
            >
              <span class="truncate" class:muted={t.archived}>{t.name}</span>
              {#if t.archived}<span class="badge">archived</span>{/if}
              {#if t.sourceStatus === 'orphaned'}<span class="badge warn">orphaned</span>{/if}
            </a>
            <button
              type="button"
              class="icon small ghost"
              aria-label="Move technique up"
              disabled={ti === 0}
              onclick={() => moveTechnique(t.id, c.id, -1)}>▲</button
            >
            <button
              type="button"
              class="icon small ghost"
              aria-label="Move technique down"
              disabled={ti === techniques.length - 1}
              onclick={() => moveTechnique(t.id, c.id, 1)}>▼</button
            >
          </li>
        {/each}
      </ul>
      <form
        class="row nowrap"
        onsubmit={(e) => {
          e.preventDefault();
          addTechnique(c.id);
        }}
      >
        <input
          type="text"
          class="grow"
          placeholder="New technique name"
          bind:value={newTechnique[c.id]}
          aria-label="New technique name in {c.name}"
        />
        <button type="submit" class="small" disabled={!(newTechnique[c.id] ?? '').trim()}
          >Add</button
        >
      </form>
    </div>
  {/each}

  <form
    class="row nowrap"
    style="margin-top:12px"
    onsubmit={(e) => {
      e.preventDefault();
      addChapter();
    }}
  >
    <input
      type="text"
      class="grow"
      placeholder="New chapter name"
      bind:value={newChapter}
      aria-label="New chapter name"
    />
    <button type="submit" class="primary" disabled={!newChapter.trim()}>+ Chapter</button>
  </form>
{/if}
