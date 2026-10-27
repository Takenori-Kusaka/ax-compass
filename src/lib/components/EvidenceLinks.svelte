<!-- 「根拠」の行。本の章と一次資料へのリンクを並べる。主張の直下に置く -->
<script lang="ts">
  import { chapterTitle, chapterUrl } from '../engine.mjs';
  import { evidence as allEvidence, framework } from '../data';

  let { chapters = [], evidence = [] }: { chapters?: string[]; evidence?: string[] } = $props();
  const items = $derived(evidence.map((id) => allEvidence.find((e) => e.id === id)).filter((e) => !!e));
</script>

{#if chapters.length > 0 || items.length > 0}
  <p class="evidence">
    根拠:
    {#each chapters as slug}
      <a href={chapterUrl(framework, slug)} target="_blank" rel="noopener">{chapterTitle(framework, slug)}</a>
    {/each}
    {#each items as e}
      <a href={e.url} target="_blank" rel="noopener">{e.label}({e.publisher}、{e.date})</a>
    {/each}
  </p>
{/if}
