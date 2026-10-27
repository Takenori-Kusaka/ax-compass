<!-- 工程の表示。5 つの画面のどこにいるかを示し、終えた工程へは戻れる -->
<script lang="ts">
  import { app } from '../store.svelte';

  const steps = ['はじめに', '現在地診断', '未来の選択', '悩みの整理', '結果'];
  let { canJump }: { canJump: (index: number) => boolean } = $props();
</script>

<ol class="stepper" aria-label="工程">
  {#each steps as label, i}
    <li aria-current={app.step === i ? 'step' : undefined} class:done={i < app.step}>
      {#if canJump(i)}
        <button type="button" onclick={() => (app.step = i)}>{i + 1}. {label}</button>
      {:else}
        <span>{i + 1}. {label}</span>
      {/if}
    </li>
  {/each}
</ol>
