<!-- 3 軸の現在地を 1 画面に図示する。色だけに頼らず、段階名を文字で併記する -->
<script lang="ts">
  import type { Diagnosis } from '../engine.mjs';
  import { framework } from '../data';

  let { diagnosis }: { diagnosis: Diagnosis } = $props();
  const b = $derived(diagnosis.business);
  const s = $derived(diagnosis.adoption);
  const c = $derived(diagnosis.culture);
</script>

<div class="position-chart">
  <div class="position-row">
    <div class="row-label">事業フェーズ</div>
    <div class="segments" role="img" aria-label={`事業フェーズ: ${b.phase ? b.phase.name : '未回答'}`}>
      {#each framework.business.phases as p}
        <div class="segment phase" class:current={b.phase?.id === p.id}>{p.short}</div>
      {/each}
    </div>
    <div class="row-value">{b.phase ? `${b.phase.name}: ${b.phase.definition}` : '未回答'}</div>
  </div>

  <div class="position-row">
    <div class="row-label">導入フェーズ</div>
    <div class="segments" role="img" aria-label={`導入フェーズ: ${s.stage ? `${s.stage.id} ${s.stage.name}` : '未回答'}`}>
      {#each framework.adoption.stages as st}
        <div class="segment" class:reached={s.level !== null && st.level < s.level} class:current={s.level === st.level}>{st.id}</div>
      {/each}
    </div>
    <div class="row-value">{s.stage ? `${s.stage.id} ${s.stage.name}: ${s.stage.definition}` : '未回答'}</div>
  </div>

  <div class="position-row">
    <div class="row-label">文化フェーズ</div>
    <div class="segments" role="img" aria-label={`文化フェーズ: ${c.stage ? `${c.stage.id} ${c.stage.name}` : '未回答'}`}>
      {#each framework.culture.stages as st}
        <div class="segment" class:reached={c.level !== null && st.level < c.level} class:current={c.level === st.level}>{st.id}</div>
      {/each}
    </div>
    <div class="row-value">{c.stage ? `${c.stage.id} ${c.stage.name}: ${c.stage.definition}` : '未回答'}</div>
  </div>
</div>
