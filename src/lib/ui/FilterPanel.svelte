<script lang="ts">
  import { isDefaultFilters } from '../model/filter';
  import { prefs } from './prefs.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const isDefault = $derived(isDefaultFilters(prefs.filters));
</script>

<div class="card">
  <div class="row between">
    <strong>Filters</strong>
    <div class="row">
      <button
        type="button"
        class="small ghost"
        disabled={isDefault}
        onclick={() => prefs.clearFilters()}>Clear filters</button
      >
      <button type="button" class="small ghost" aria-label="Close" onclick={onclose}>✕</button>
    </div>
  </div>
  <div class="grid">
    <label class="field">
      <span>Read</span>
      <select bind:value={prefs.filters.read}>
        <option value="any">Any</option>
        <option value="yes">Read</option>
        <option value="no">Not read</option>
      </select>
    </label>
    <label class="field">
      <span>Drilled</span>
      <select bind:value={prefs.filters.drilled}>
        <option value="any">Any</option>
        <option value="yes">Drilled</option>
        <option value="no">Not drilled</option>
      </select>
    </label>
    <label class="field">
      <span>Sparred</span>
      <select bind:value={prefs.filters.spar}>
        <option value="any">Any</option>
        <option value="lt3">Less than 3</option>
        <option value="0">0</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
      </select>
    </label>
    <label class="field">
      <span>Archived</span>
      <select bind:value={prefs.filters.archived}>
        <option value="hide">Hide archived</option>
        <option value="show">Show archived</option>
        <option value="only">Archived only</option>
      </select>
    </label>
    <label class="field span2">
      <span>Sort</span>
      <select bind:value={prefs.filters.sort}>
        <option value="default">Book / Chapter order</option>
        <option value="sparAsc">Least sparred first</option>
        <option value="sparDesc">Most sparred first</option>
        <option value="name">Name</option>
        <option value="read">Read first</option>
        <option value="drilled">Drilled first</option>
      </select>
    </label>
  </div>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 12px;
  }
  .span2 {
    grid-column: 1 / -1;
  }
</style>
