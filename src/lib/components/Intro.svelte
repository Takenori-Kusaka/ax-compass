<!-- はじめに。目的、使い方、枠組みの要約、入力の扱い -->
<script lang="ts">
  import { app, replaceState } from '../store.svelte';
  import { BOOK_URL, framework, questions } from '../data';
  import { parseState } from '../engine.mjs';
  import EvidenceLinks from './EvidenceLinks.svelte';

  let { hasSaved, onReset }: { hasSaved: boolean; onReset: () => void } = $props();
  let fileInput: HTMLInputElement | undefined = $state();
  let status = $state('');

  /** 保存した JSON を別の端末でも開けるように、はじめにの画面から読み込む。失敗したら何も変えない */
  async function loadJson(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = parseState(JSON.parse(await file.text()), questions);
      if (!parsed) throw new Error('形式が違います');
      parsed.step = 4;
      replaceState(parsed);
    } catch {
      status = `${file.name} を読み込めませんでした。このアプリで保存した JSON を選びます`;
    }
    input.value = '';
  }
</script>

<h2>はじめに</h2>
<p>
  AXコンパスは、生成AIとAIエージェントの導入について、自社の現在地を 3 つの軸で特定し、目指す道筋を選び、次に取るべきステップを根拠つきで整理するための道具です。
  結果は経営会議に出せる資料(本の第38章の 8 つの見出しの型。A4 で 1〜2 枚)として印刷・保存できます。
</p>
<p>
  枠組みは本『<a href={BOOK_URL} target="_blank" rel="noopener">{framework.book.title}<span class="visually-hidden">(新しいタブで開く)</span></a>』第Ⅴ部に従います。本を読んでいなくても使えます。
</p>

<div class="card">
  <h3>進め方</h3>
  <ol>
    <li>現在地診断: 3 つの軸について、それぞれ 5〜6 問の選択式に答えます。所要時間は 10 分ほどです。</li>
    <li>未来の選択: 3 つの道筋(加速・漸進・調整)から 1 つを選びます。決めない選択もできます。</li>
    <li>悩みの整理: 経営層の典型的な悩みから、当てはまるものを選びます。</li>
    <li>結果: 現在地、道筋、早期警戒指標、次の一手、運営モデル、必要なもの、統治の最低限、答えていない問いの 8 つの見出しにまとめます。</li>
  </ol>
</div>

<div class="card">
  <h3>3 つの軸</h3>
  <ul>
    <li><strong>事業フェーズ</strong>: {framework.business.description}</li>
    <li><strong>導入フェーズ</strong>: {framework.adoption.description}</li>
    <li><strong>文化フェーズ</strong>: {framework.culture.description}</li>
  </ul>
  <EvidenceLinks chapters={['32-three-positions', 'overview-map']} />
</div>

<div class="card">
  <h3>会議で使うスライド</h3>
  <p>
    本の各章の要点を 1 枚ずつ並べたスライド(PowerPoint 形式、40 枚)を用意しています。最後の 1 枚は、経営会議に出す資料の型(本の第38章の 8 つの見出し)です。
    診断の結果と合わせて、会議の説明に使えます。
  </p>
  <p><a class="btn" href={`${import.meta.env.BASE_URL}ax-blueprint-slides.pptx`} download>スライドをダウンロード(約 5MB)</a></p>
</div>

<div class="note">
  <p>診断は自己申告に基づく目安です。1 つの正解を出す道具ではありません。</p>
  <p>入力は端末のブラウザにだけ保存され、外部へ送信しません。氏名や会社名などの個人情報は入力しない設計です。</p>
</div>

<div class="actions">
  <button type="button" class="btn primary" onclick={() => (app.step = 1)}>{hasSaved ? '続きから始める' : '現在地診断を始める'}</button>
  {#if hasSaved}
    <button type="button" class="btn" onclick={onReset}>回答を消して最初から</button>
  {/if}
  <button type="button" class="btn" onclick={() => fileInput?.click()}>保存した JSON を読み込む</button>
  <input type="file" accept="application/json,.json" class="visually-hidden" bind:this={fileInput} onchange={loadJson} aria-label="JSON ファイルを選ぶ" />
</div>
{#if status}<p class="status" role="status">{status}</p>{/if}
