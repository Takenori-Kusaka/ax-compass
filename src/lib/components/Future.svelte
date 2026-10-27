<!-- 目指す未来の選択。3 つの道筋と「決めない」を、前提・2029 年の像・早期警戒指標とともに示す -->
<script lang="ts">
  import { app } from '../store.svelte';
  import { framework } from '../data';
  import type { PathId } from '../engine.mjs';
  import EvidenceLinks from './EvidenceLinks.svelte';

  const u = framework.undecided;
  function choose(id: PathId) {
    app.path = id;
  }
</script>

<h2>目指す未来の選択</h2>
<p>
  2031 年までに世界がどう動くかについて、本は 3 つの道筋を並べています。1 つの正解はありません。
  自社がどの道筋を前提に動くかを選びます。決めない場合は、どの道筋でも後悔しない手と、選択権を買う手が優先されます。
</p>
<p class="term">早期警戒指標とは、どの道筋に進んでいるかを早めに知るために定期的に見る数値や出来事のことです。</p>

<fieldset>
  <legend>道筋を 1 つ選びます</legend>
  <div class="path-grid">
    {#each framework.paths as p}
      <label class="path-card">
        <input type="radio" name="path" value={p.id} checked={app.path === p.id} onchange={() => choose(p.id as PathId)} />
        <h3>{p.name}</h3>
        <dl>
          <dt>前提</dt>
          <dd>{p.premise}</dd>
          <dt>2029 年の像</dt>
          <dd>{p.image2029}</dd>
          <dt>早期警戒指標</dt>
          <dd><ul>{#each p.indicators as ind}<li>{ind}</li>{/each}</ul></dd>
        </dl>
      </label>
    {/each}
  </div>
  <div class="path-grid" style="margin-top: 0.75rem">
    <label class="path-card">
      <input type="radio" name="path" value={u.id} checked={app.path === 'undecided'} onchange={() => choose('undecided')} />
      <h3>{u.name}</h3>
      <dl>
        <dt>前提</dt>
        <dd>{u.premise}</dd>
        <dt>進め方</dt>
        <dd>{u.image2029}</dd>
      </dl>
    </label>
  </div>
</fieldset>

<EvidenceLinks chapters={['29-paths-comparison-indicators', '26-path-a-acceleration', '27-path-b-gradual', '28-path-c-correction', '35-strategy-by-path']} />

<div class="actions">
  <button type="button" class="btn" onclick={() => (app.step = 1)}>戻る</button>
  <button type="button" class="btn primary" disabled={!app.path} onclick={() => (app.step = 3)}>悩みの整理へ進む</button>
  {#if !app.path}<span class="status">道筋を選ぶと進めます</span>{/if}
</div>
