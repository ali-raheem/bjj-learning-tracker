<script lang="ts">
  import BackupView from './routes/BackupView.svelte';
  import BookDetail from './routes/BookDetail.svelte';
  import BooksView from './routes/BooksView.svelte';
  import TechniqueDetail from './routes/TechniqueDetail.svelte';
  import TechniquesView from './routes/TechniquesView.svelte';
  import { data } from './lib/ui/data.svelte';
  import { href, router } from './lib/ui/router.svelte';

  data.start();

  const section = $derived(
    router.route.name === 'technique' || router.route.name === 'techniques'
      ? 'techniques'
      : router.route.name === 'book' || router.route.name === 'books'
        ? 'books'
        : 'backup',
  );
</script>

<main>
  {#if data.error}
    <div class="notice danger">Could not open the local database: {data.error}</div>
  {:else if !data.ready}
    <p class="muted">Loading…</p>
  {:else if router.route.name === 'technique'}
    <TechniqueDetail id={router.route.id} />
  {:else if router.route.name === 'books'}
    <BooksView />
  {:else if router.route.name === 'book'}
    <BookDetail id={router.route.id} />
  {:else if router.route.name === 'backup'}
    <BackupView />
  {:else}
    <TechniquesView />
  {/if}
</main>

<nav class="bottom" aria-label="Main">
  <a
    href={href('')}
    class:active={section === 'techniques'}
    aria-current={section === 'techniques' ? 'page' : undefined}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg
    >
    Techniques
  </a>
  <a
    href={href('books')}
    class:active={section === 'books'}
    aria-current={section === 'books' ? 'page' : undefined}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      ><path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"
      /></svg
    >
    Books
  </a>
  <a
    href={href('backup')}
    class:active={section === 'backup'}
    aria-current={section === 'backup' ? 'page' : undefined}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      ><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg
    >
    Backup
  </a>
</nav>
