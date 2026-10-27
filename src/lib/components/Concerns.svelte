<!-- 悩みの整理。典型的な悩みを複数選択し、結果に反映する -->
<script lang="ts">
  import { app } from '../store.svelte';
  import { concerns } from '../data';

  function toggle(id: string, on: boolean) {
    const set = new Set(app.concerns);
    if (on) set.add(id);
    else set.delete(id);
    app.concerns = concerns.filter((c) => set.has(c.id)).map((c) => c.id);
  }
</script>

<h2>悩みの整理</h2>
<p>経営層からよく聞く悩みを並べています。当てはまるものを選びます。選ばなくても進めます。</p>

<fieldset>
  <legend>当てはまる悩み(複数選択)</legend>
  <div class="options">
    {#each concerns as c}
      <label class="option">
        <input type="checkbox" value={c.id} checked={app.concerns.includes(c.id)} onchange={(e) => toggle(c.id, (e.currentTarget as HTMLInputElement).checked)} />
        <span>{c.label}</span>
      </label>
    {/each}
  </div>
</fieldset>

<p class="status" role="status">選択 {app.concerns.length} 件</p>

<div class="actions">
  <button type="button" class="btn" onclick={() => (app.step = 2)}>戻る</button>
  <button type="button" class="btn primary" onclick={() => (app.step = 4)}>結果を見る</button>
</div>
