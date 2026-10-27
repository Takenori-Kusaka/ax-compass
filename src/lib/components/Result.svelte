<!-- 結果。会議体向け 1 枚資料(.sheet)と、印刷・コピー・保存・復元・共有の操作(.no-print) -->
<script lang="ts">
  import { app, replaceState } from '../store.svelte';
  import { concerns, data, evidence as allEvidence, framework, questions } from '../data';
  import { buildPlan, concernReport, diagnose, encodeState, parseState, toMarkdown, weakestAnswers } from '../engine.mjs';
  import PositionChart from './PositionChart.svelte';
  import EvidenceLinks from './EvidenceLinks.svelte';

  const diagnosis = $derived(diagnose(framework, questions, app.answers));
  const path = $derived(app.path && app.path !== 'undecided' ? framework.paths.find((p) => p.id === app.path) ?? null : null);
  const plan = $derived(
    app.path && diagnosis.adoption.level && diagnosis.culture.level
      ? buildPlan(framework, { business: diagnosis.business.phase, adoption: diagnosis.adoption.level, culture: diagnosis.culture.level }, app.path)
      : null,
  );
  const weakest = $derived(
    questions.axes
      .filter((a) => a.id !== 'business')
      .flatMap((a) => weakestAnswers(a, a.id === 'adoption' ? app.answers.adoption : app.answers.culture).items.map((x) => `${a.label}: ${x.question.text}`)),
  );
  const selectedConcerns = $derived(concernReport(concerns, app.concerns));

  let status = $state('');
  let shareUrl = $state('');
  let fileInput: HTMLInputElement | undefined = $state();

  function print() {
    window.print();
  }

  async function copyMarkdown() {
    const md = toMarkdown(data, app);
    try {
      await navigator.clipboard.writeText(md);
      status = 'Markdown をクリップボードにコピーしました';
    } catch {
      status = 'クリップボードに書き込めませんでした。下の欄から手で選択してコピーします';
      shareUrl = md;
    }
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify({ ...app, savedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ax-compass.json';
    a.click();
    URL.revokeObjectURL(url);
    status = 'JSON をダウンロードしました';
  }

  async function loadJson(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = parseState(JSON.parse(await file.text()), questions);
      if (!parsed) throw new Error('形式が違います');
      parsed.step = 4;
      replaceState(parsed);
      status = `${file.name} を読み込みました`;
    } catch {
      status = 'JSON を読み込めませんでした。このアプリで保存したファイルを選びます';
    }
    input.value = '';
  }

  async function share() {
    const encoded = encodeState(app, questions);
    const url = `${location.origin}${location.pathname}#s=${encoded}`;
    history.replaceState(null, '', `#s=${encoded}`);
    shareUrl = url;
    try {
      await navigator.clipboard.writeText(url);
      status = '共有用の URL をコピーしました。回答だけを含み、個人情報は含みません';
    } catch {
      status = '共有用の URL を下の欄に表示しました';
    }
  }

  const evidenceOf = (ids: string[]) => ids.map((id) => allEvidence.find((e) => e.id === id)).filter((e) => !!e);
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
</script>

<h2 class="no-print">結果</h2>
<p class="no-print">
  経営会議に出せる 1 枚の資料です。印刷すると、この資料だけが A4 に収まる形で出ます。Markdown のコピーは議事録や社内文書への貼り付けに、JSON は回答の保存と復元に使います。
</p>

<div class="actions no-print">
  <button type="button" class="btn primary" onclick={print}>印刷する</button>
  <button type="button" class="btn" onclick={copyMarkdown}>Markdown をコピー</button>
  <button type="button" class="btn" onclick={downloadJson}>JSON を保存</button>
  <button type="button" class="btn" onclick={() => fileInput?.click()}>JSON を読み込む</button>
  <input type="file" accept="application/json,.json" class="visually-hidden" bind:this={fileInput} onchange={loadJson} aria-label="JSON ファイルを選ぶ" />
  <button type="button" class="btn" onclick={share}>共有用の URL を作る</button>
</div>
{#if status}<p class="status no-print" role="status">{status}</p>{/if}
{#if shareUrl}
  <textarea class="share no-print" rows="3" readonly aria-label="共有用の内容">{shareUrl}</textarea>
{/if}

<article class="sheet" aria-labelledby="sheet-title">
  <h2 id="sheet-title">AX コンパス ── 現在地と次のステップ</h2>
  <p class="meta">{today} 作成。自己申告に基づく目安。段階の定義は『{framework.book.title}』第Ⅴ部に従う。</p>

  <h3>1. 現在地</h3>
  <PositionChart {diagnosis} />
  {#if diagnosis.business.phase}
    <p style="margin-top: 0.75rem">{diagnosis.business.phase.aiFocus}</p>
  {/if}
  {#if weakest.length > 0}<p>次に上げるべき場所(最も低い答えの設問): {weakest.join('、')}</p>{/if}
  <EvidenceLinks chapters={['32-three-positions']} />

  <h3>2. 目指す道筋</h3>
  {#if path}
    <p><strong>{path.name}</strong>: {path.premise}</p>
    <div class="sheet-grid two">
      <div>
        <h4>2029 年の像</h4>
        <p>{path.image2029}</p>
      </div>
      <div>
        <h4>早期警戒指標</h4>
        <ul>{#each path.indicators as ind}<li>{ind}</li>{/each}</ul>
      </div>
    </div>
    <EvidenceLinks chapters={[path.chapter, '29-paths-comparison-indicators']} />
  {:else if app.path === 'undecided'}
    <p><strong>{framework.undecided.name}</strong>: {framework.undecided.premise} {framework.undecided.image2029}</p>
    <EvidenceLinks chapters={[framework.undecided.chapter, '29-paths-comparison-indicators']} />
  {:else}
    <p>未選択。未来の選択の画面で道筋を選ぶと、ここに表示されます。</p>
  {/if}

  {#if plan}
    <h3>3. 次のステップ(期間の目安: {plan.horizon})</h3>
    <p>{plan.businessNote}</p>
    {#each plan.steps as s}
      <div class="step-block">
        <p class="step-title">ステップ {s.order}: <span class="stage-id">{s.stage.id}</span>{s.stage.name}</p>
        <p>目的: {s.purpose}</p>
        <div class="sheet-grid two">
          <div>
            <h4>やること</h4>
            <ul>{#each s.actions as a}<li>{a}</li>{/each}</ul>
          </div>
          <div>
            <h4>必要なもの</h4>
            <dl class="req">
              <dt>人材</dt><dd>{s.requirements.people}</dd>
              <dt>データ</dt><dd>{s.requirements.data}</dd>
              <dt>統治</dt><dd>{s.requirements.governance}</dd>
              <dt>評価</dt><dd>{s.requirements.evaluation}</dd>
              <dt>費用</dt><dd>{s.requirements.cost}</dd>
            </dl>
          </div>
        </div>
        <h4>関わる提供事業者の層</h4>
        <ul class="tag-list">{#each s.layers as l}<li>{l.id} {l.name}</li>{/each}</ul>
        <h4>運営モデルの推奨: {s.operatingModel.name}</h4>
        <p>{s.operatingModel.definition} {s.operatingModelReason}</p>
        <p>{s.pathNote}</p>
        <EvidenceLinks chapters={s.chapters} />
      </div>
    {/each}

    <h3>4. 道筋別の手</h3>
    <div class="sheet-grid two">
      <div>
        <h4>後悔しない手(どの道筋でも必要)</h4>
        <ul>{#each plan.moves.noRegret as m}<li>{m}</li>{/each}</ul>
      </div>
      <div>
        <h4>選択権を買う手(小さく投資して将来の選択肢を残す)</h4>
        <ul>{#each plan.moves.option as m}<li>{m}</li>{/each}</ul>
        <h4>賭ける手(道筋が当たったときに大きく効く)</h4>
        {#if plan.moves.bet.length === 0}
          <p>道筋を選んでから検討します。</p>
        {:else}
          <ul>{#each plan.moves.bet as m}<li>{m}</li>{/each}</ul>
        {/if}
      </div>
    </div>
    {#if plan.moves.caution}<p class="note">{plan.moves.caution}</p>{/if}
    <EvidenceLinks chapters={['35-strategy-by-path']} evidence={['gartner-agentic-2025', 'mckinsey-2025']} />

    <h3>5. 文化を 1 段上げる施策</h3>
    <p>
      <strong>{plan.culture.current.id} {plan.culture.current.name}</strong>
      から
      {#if plan.culture.target}<strong>{plan.culture.target.id} {plan.culture.target.name}</strong> へ{:else}最上位に到達しているため、維持と点検へ{/if}
    </p>
    <ul>{#each plan.culture.measures as m}<li>{m}</li>{/each}</ul>
    <EvidenceLinks chapters={['36-culture-formation']} evidence={['jcurve', 'rogers-diffusion']} />
  {:else}
    <h3>3. 次のステップ</h3>
    <p>現在地診断と道筋の選択を終えると、ここにステップが表示されます。</p>
  {/if}

  {#if selectedConcerns.length > 0}
    <h3>{plan ? '6' : '4'}. 悩みと対応</h3>
    {#each selectedConcerns as c}
      <div class="step-block">
        <p class="step-title">{c.label}</p>
        <p>{c.step}</p>
        <p class="term">関係する軸: {c.axes.map((a) => (a === 'business' ? '事業' : a === 'adoption' ? '導入' : '文化')).join('、')}</p>
        <EvidenceLinks chapters={c.chapters} evidence={c.evidence} />
      </div>
    {/each}
  {/if}

  <h3 class="refs">参照した一次資料</h3>
  <ul class="evidence-list refs">
    {#each evidenceOf(allEvidence.map((e) => e.id)) as e}
      <li><a href={e.url} target="_blank" rel="noopener">{e.label}</a>({e.publisher}、{e.date})</li>
    {/each}
  </ul>
  <p class="meta">AX コンパス(https://takenori-kusaka.github.io/ax-compass/)で作成。このアプリと本は生成AIを使って作成し、著者が内容を確認して公開しています。</p>
</article>

<div class="actions no-print">
  <button type="button" class="btn" onclick={() => (app.step = 3)}>戻る</button>
  <button type="button" class="btn" onclick={() => (app.step = 1)}>診断をやり直す</button>
</div>
