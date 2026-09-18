<script lang="ts">
  import { MAX_SPARRING } from '../model/types';

  let {
    value,
    onchange,
    large = false,
    label = 'Sparred',
  }: { value: number; onchange: (n: number) => void; large?: boolean; label?: string } = $props();

  // Tapping marker N sets the count to N; tapping the current top marker undoes it.
  function tap(i: number) {
    onchange(value === i + 1 ? i : i + 1);
  }
</script>

<div class="spar" class:large role="group" aria-label={label}>
  {#each { length: MAX_SPARRING } as _, i (i)}
    <button
      type="button"
      class:on={i < value}
      aria-pressed={i < value}
      aria-label="{label} {i + 1}"
      onclick={() => tap(i)}
    ></button>
  {/each}
</div>
