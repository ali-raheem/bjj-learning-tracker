<script lang="ts">
  import { repo } from '../lib/db/repo';
  import {
    backupFilename,
    exportBackup,
    parseBackupFile,
    restoreBackup,
    type BackupFile,
    type RestoreMode,
    type RestoreSummary,
  } from '../lib/import/backup';
  import { BOOK_FILE_ACCEPT, parseAnyBookFile } from '../lib/import/anyBook';
  import { importBook, type BookFile, type BookImportSummary } from '../lib/import/bookImport';
  import { ImportError } from '../lib/import/validation';
  import { data } from '../lib/ui/data.svelte';
  import { persistentStorage } from '../lib/ui/storage.svelte';
  import {
    confirmAction,
    errorMessage,
    formatRelativeDays,
    pickFile,
    shareOrDownloadJson,
  } from '../lib/ui/files';
  import { prefs } from '../lib/ui/prefs.svelte';

  let error = $state('');
  let problems = $state<string[]>([]);
  let pendingBackup = $state<BackupFile | null>(null);
  let restoreResult = $state<RestoreSummary | null>(null);
  let pendingBook = $state<BookFile | null>(null);
  let bookResult = $state<BookImportSummary | null>(null);

  function reset() {
    error = '';
    problems = [];
    pendingBackup = null;
    restoreResult = null;
    pendingBook = null;
    bookResult = null;
    exportOutcome = '';
  }
  function fail(e: unknown) {
    if (e instanceof ImportError) {
      error = e.summary;
      problems = e.problems;
    } else error = errorMessage(e);
  }

  let exportOutcome = $state('');
  async function doExport() {
    reset();
    try {
      const outcome = await shareOrDownloadJson(await exportBackup(), backupFilename());
      if (outcome !== 'cancelled') {
        prefs.markBackedUp();
        exportOutcome = outcome === 'shared' ? 'Backup shared.' : 'Backup downloaded.';
      }
    } catch (e) {
      fail(e);
    }
  }

  async function chooseBackup() {
    reset();
    const file = await pickFile();
    if (!file) return;
    try {
      pendingBackup = parseBackupFile(await file.text());
    } catch (e) {
      fail(e);
    }
  }
  async function doRestore(mode: RestoreMode) {
    if (!pendingBackup) return;
    const msg =
      mode === 'replace'
        ? `Replace everything currently in this app (${data.books.length} Books, ${data.techniques.length} techniques) with the backup? This cannot be undone.`
        : `Merge the backup into the current data? Records with matching ids are overwritten by the backup; everything else is kept.`;
    if (!confirmAction(msg)) return;
    try {
      // Snapshot: IndexedDB cannot structured-clone Svelte state proxies.
      restoreResult = await restoreBackup($state.snapshot(pendingBackup), mode);
      pendingBackup = null;
    } catch (e) {
      fail(e);
    }
  }

  async function chooseBook() {
    reset();
    const file = await pickFile(BOOK_FILE_ACCEPT);
    if (!file) return;
    try {
      pendingBook = parseAnyBookFile(await file.text(), file.name);
    } catch (e) {
      fail(e);
    }
  }
  const pendingBookExisting = $derived(
    pendingBook ? data.books.find((b) => b.externalId === pendingBook!.book.externalId) : undefined,
  );
  const pendingBookCount = $derived(
    pendingBook ? pendingBook.book.chapters.reduce((s, c) => s + c.techniques.length, 0) : 0,
  );
  async function doImportBook() {
    if (!pendingBook) return;
    try {
      bookResult = await importBook($state.snapshot(pendingBook));
      pendingBook = null;
    } catch (e) {
      fail(e);
    }
  }

  async function wipe() {
    if (
      !confirmAction(
        'Delete ALL Books, techniques, notes and progress from this device? Export a backup first if you might want them back.',
      )
    )
      return;
    if (!confirmAction('Really delete everything? This cannot be undone.')) return;
    await repo.clearAll();
    reset();
  }
</script>

<h1>Backup</h1>

<p class="muted">
  All data lives on this device. Export a backup regularly and keep it somewhere safe.
</p>

{#if error}
  <div class="notice danger" role="alert">
    <strong>{error}</strong>
    {#if problems.length}<pre class="problems">{problems.join('\n')}</pre>{/if}
  </div>
{/if}

<h2>Export</h2>
<div class="card">
  <p class="small">
    {data.books.length} Books · {data.chapters.length} chapters · {data.techniques.length} techniques
  </p>
  <p class="small" class:error={prefs.backupDue()} class:muted={!prefs.backupDue()}>
    Last backup: {formatRelativeDays(prefs.backupAgeDays())}
    {#if prefs.backupDue()}— it's a good time to make one{/if}
  </p>
  {#if persistentStorage.supported}
    <p
      class="small"
      class:error={persistentStorage.persisted === false}
      class:muted={persistentStorage.persisted !== false}
    >
      Storage: {persistentStorage.persisted ? 'persistent' : 'not persistent'}
      {#if persistentStorage.persisted === false}
        — the browser may clear app data under storage pressure; back up regularly
      {/if}
    </p>
  {/if}
  <button type="button" class="primary" onclick={doExport}>Export backup</button>
  {#if exportOutcome}<p class="success small">{exportOutcome}</p>{/if}
</div>

<h2>Restore backup</h2>
<div class="card">
  <p class="small muted">Restores a full backup file made by this app.</p>
  <button type="button" onclick={chooseBackup}>Choose backup file…</button>
  {#if pendingBackup}
    <div class="notice" style="margin-top:12px">
      <p style="margin:0 0 6px">
        <strong
          >Backup from {pendingBackup.exportedAt
            ? new Date(pendingBackup.exportedAt).toLocaleString()
            : 'unknown date'}</strong
        ><br />
        {pendingBackup.books.length} Books · {pendingBackup.chapters.length} chapters ·
        {pendingBackup.techniques.length} techniques
      </p>
      <p class="small" style="margin:0 0 8px">
        <strong>Replace</strong> deletes what is on this device first. <strong>Merge</strong> keeps local
        data and overwrites only records with the same id.
      </p>
      <div class="row">
        <button type="button" class="danger" onclick={() => doRestore('replace')}
          >Replace current data</button
        >
        <button type="button" onclick={() => doRestore('merge')}>Merge into current data</button>
        <button type="button" class="ghost" onclick={() => (pendingBackup = null)}>Cancel</button>
      </div>
    </div>
  {/if}
  {#if restoreResult}
    <p class="success">
      Restored ({restoreResult.mode}): {restoreResult.books} Books, {restoreResult.chapters} chapters,
      {restoreResult.techniques} techniques.
    </p>
  {/if}
</div>

<h2>Import Book</h2>
<div class="card">
  <p class="small muted">
    Imports a Book definition file (a curriculum, an index of a book, a course), as JSON or as a
    plain text file with “# Chapter” headings and one technique per line. Re-importing a newer
    version of the same source updates names and structure and keeps your progress.
  </p>
  <button type="button" onclick={chooseBook}>Choose Book file…</button>
  {#if pendingBook}
    <div class="notice" style="margin-top:12px">
      <p style="margin:0 0 8px">
        <strong>{pendingBook.book.name}</strong>
        {#if pendingBook.book.version}<span class="badge">v{pendingBook.book.version}</span>{/if}<br
        />
        {pendingBook.book.chapters.length} chapters · {pendingBookCount} techniques<br />
        {#if pendingBookExisting}
          Will update the existing Book “{pendingBookExisting.name}”. Your progress, notes and links
          are kept.
        {:else}
          Will be added as a new Book.
        {/if}
      </p>
      <div class="row">
        <button type="button" class="primary" onclick={doImportBook}
          >{pendingBookExisting ? 'Update Book' : 'Import Book'}</button
        >
        <button type="button" class="ghost" onclick={() => (pendingBook = null)}>Cancel</button>
      </div>
    </div>
  {/if}
  {#if bookResult}
    <p class="success">
      {bookResult.createdBook ? 'Imported' : 'Updated'} “{bookResult.bookName}”: {bookResult.techniquesAdded}
      added,
      {bookResult.techniquesUpdated} updated, {bookResult.techniquesOrphaned} orphaned,
      {bookResult.techniquesRemoved} removed.
    </p>
  {/if}
</div>

<h2>Danger zone</h2>
<div class="card">
  <button type="button" class="danger" onclick={wipe}>Delete all data on this device</button>
</div>

<p class="muted small" style="margin-top:24px;text-align:center">
  Version {__APP_COMMIT__}
  {#if __APP_COMMIT_DATE__}· committed {new Date(__APP_COMMIT_DATE__).toLocaleString()}{/if}
</p>
