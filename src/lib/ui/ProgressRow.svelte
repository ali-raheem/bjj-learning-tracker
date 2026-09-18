<script lang="ts">
  import { repo } from '../db/repo';
  import type { Technique } from '../model/types';
  import Sparring from './Sparring.svelte';

  let { technique, large = false }: { technique: Technique; large?: boolean } = $props();
</script>

<div class="row progress" class:large>
  <button
    type="button"
    class="chip"
    class:on={technique.read}
    aria-pressed={technique.read}
    onclick={() => repo.setRead(technique.id, !technique.read)}
  >
    Read {technique.read ? '✓' : '○'}
  </button>
  <button
    type="button"
    class="chip"
    class:on={technique.drilled}
    aria-pressed={technique.drilled}
    onclick={() => repo.setDrilled(technique.id, !technique.drilled)}
  >
    Drilled {technique.drilled ? '✓' : '○'}
  </button>
  <span class="row nowrap">
    <span class="muted">Sparred</span>
    <Sparring
      value={technique.sparringSuccesses}
      onchange={(n) => repo.setSparring(technique.id, n)}
      {large}
    />
  </span>
</div>
