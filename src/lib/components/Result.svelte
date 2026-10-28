<!-- 結果。会議体向けの資料(.sheet。本 第38章の 10 の見出し)と、印刷・コピー・保存・復元・共有の操作(.no-print)。
     診断から導けない見出し(担当役員、投資と効果と撤退基準、決裁事項など)は自由記述の欄。個人情報を含みうるため共有 URL には入れない -->
<script lang="ts">
  import { app, replaceState } from '../store.svelte';
  import { concerns, data, evidence as allEvidence, framework, questions } from '../data';
  import {
    INDICATOR_NOTE,
    OPEN_QUESTIONS_MAX,
    SHEET_HEADINGS,
    SHEET_SECTIONS,
    axisShort,
    buildPlan,
    chapterUrl,
    concernReport,
    diagnose,
    earlyWarningIndicators,
    encodeState,
    governanceMinimum,
    parseState,
    toMarkdown,
    weakestSummary,
    type Notes,
  } from '../engine.mjs';
  import PositionChart from './PositionChart.svelte';
  import EvidenceLinks from './EvidenceLinks.svelte';

  const H = SHEET_HEADINGS;
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
      .map((a) => weakestSummary(a, a.id === 'adoption' ? app.answers.adoption : app.answers.culture).text)
      .filter((t) => t),
  );
  const indicators = $derived(earlyWarningIndicators(framework, app.path));
  const governance = $derived(governanceMinimum(framework, plan, diagnosis.adoption.stage));
  const selectedConcerns = $derived(concernReport(concerns, app.concerns));
  /** この資料の「根拠」行に現れた一次資料だけを末尾に列挙する */
  const PLAN_EVIDENCE = ['gartner-agentic-2025', 'mckinsey-2025', 'jcurve', 'rogers-diffusion'];
  const referencedEvidence = $derived.by(() => {
    const ids = new Set<string>([...(plan ? PLAN_EVIDENCE : []), ...selectedConcerns.flatMap((c) => c.evidence)]);
    return allEvidence.filter((e) => ids.has(e.id));
  });

  /** 自由記述の欄の読み書き(state.notes の鍵か、従来の openQuestions) */
  type NoteKey = keyof Notes | 'openQuestions';
  function getNote(key: NoteKey): string {
    return key === 'openQuestions' ? app.openQuestions : app.notes[key];
  }
  function setNote(key: NoteKey, e: Event) {
    const v = (e.currentTarget as HTMLTextAreaElement).value;
    if (key === 'openQuestions') app.openQuestions = v;
    else app.notes[key] = v;
  }

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

  /** 読み込みに失敗したときは直前の状態をそのまま残す(parseState が null を返す) */
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
      status = `${file.name} を読み込めませんでした。このアプリで保存した JSON を選びます。いまの結果はそのまま残しています`;
    }
    input.value = '';
  }

  /** 共有 URL はアドレスバーに書かず、欄とクリップボードにだけ出す(ハッシュが残ると再読込で以後の編集が消えるため) */
  async function share() {
    const encoded = encodeState(app, questions);
    const url = `${location.origin}${location.pathname}#s=${encoded}`;
    shareUrl = url;
    try {
      await navigator.clipboard.writeText(url);
      status = '共有用の URL をコピーしました。回答と道筋と悩みだけを含み、自由記述(担当役員や決裁事項など)は含みません';
    } catch {
      status = '共有用の URL を下の欄に表示しました';
    }
  }

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
</script>

<h2 class="no-print">結果</h2>
<p class="no-print">
  経営会議に出せる資料です。見出しは本の<a href={chapterUrl(framework, '38-meeting-pack')} target="_blank" rel="noopener">第38章の会議資料の型<span class="visually-hidden">(新しいタブで開く)</span></a>(10 の見出し)に合わせています。診断から導ける見出しはアプリが埋め、担当役員、投資と効果と撤退基準、決裁事項などは各社が書き足します(記入欄は端末に保存され、JSON・Markdown・印刷に含まれますが、共有用の URL には含まれません)。印刷すると、この資料だけが A4 で 1〜2 枚に出ます。Markdown のコピーは議事録や社内文書への貼り付けに、JSON は回答の保存と復元に使います。
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

{#snippet noteField(i: number, label: string | null = null)}
  {@const sec = SHEET_SECTIONS[i]}
  {@const key = sec.note as NoteKey}
  {@const id = `note-${key}`}
  <div class="sheet-note">
    {#if label}<p class="term writes"><label for={id}>{label}</label></p>{/if}
    <p class="term writes no-print">書くこと: {sec.writes}</p>
    <textarea
      {id}
      class="open-questions no-print"
      rows="3"
      maxlength={OPEN_QUESTIONS_MAX}
      placeholder={`例：${sec.example}`}
      aria-label={label ?? sec.heading}
      value={getNote(key)}
      oninput={(e) => setNote(key, e)}
    ></textarea>
    <div class="open-questions-print print-only" aria-hidden="true">
      {#if getNote(key).trim()}{getNote(key)}{:else}(未記入)書くこと: {sec.writes}{/if}
    </div>
  </div>
{/snippet}

<article class="sheet" aria-labelledby="sheet-title">
  <h2 id="sheet-title">AXコンパス ── 現在地と次のステップ</h2>
  <p class="meta">{today} 作成。自己申告に基づく目安。段階の名前と定義は『{framework.book.title}』の表に、見出しは第38章の会議資料の型に従う。</p>

  <h3>{H[0]}</h3>
  <PositionChart {diagnosis} />
  {#if diagnosis.business.phase}
    <p class="print-omit" style="margin-top: 0.75rem">{diagnosis.business.phase.aiFocus}</p>
  {/if}
  {#if weakest.length > 0}
    <p class="weakest-label">次に上げるべき場所(最も低い答えの設問):</p>
    <ul class="weakest">{#each weakest as w}<li>{w}</li>{/each}</ul>
  {/if}
  {@render noteField(0, '部門別の分布、対象とする拠点の範囲')}
  <EvidenceLinks chapters={SHEET_SECTIONS[0].chapters} />

  <h3>{H[1]}</h3>
  {#if path}
    <p><strong>{path.name}</strong>: {path.premise}</p>
    <p><span class="term">2029 年の像:</span> {path.image2029}</p>
    <EvidenceLinks chapters={[path.chapter, '29-paths-comparison-indicators']} />
  {:else if app.path === 'undecided'}
    <p><strong>{framework.undecided.name}</strong>: {framework.undecided.premise} {framework.undecided.image2029}</p>
    <EvidenceLinks chapters={[framework.undecided.chapter, '29-paths-comparison-indicators']} />
  {:else}
    <p>未選択。未来の選択の画面で道筋を選ぶと、ここに表示されます。</p>
  {/if}

  <h3>{H[2]}</h3>
  {#if indicators.length === 0}
    <p>道筋を選ぶと表示されます。</p>
  {:else}
    {#each indicators as g}
      {#if indicators.length > 1}<h4>{g.group}</h4>{/if}
      <ul>{#each g.items as ind}<li>{ind}</li>{/each}</ul>
    {/each}
    <p class="term">{INDICATOR_NOTE}</p>
    {@render noteField(2, '現在値、担当、確認の頻度')}
    <EvidenceLinks chapters={['29-paths-comparison-indicators']} />
  {/if}

  <h3>{H[3]}</h3>
  {#if plan}
    <p class="meta">期間の目安: {plan.horizon}</p>
    <p class="print-omit">{plan.businessNote}</p>
    <div class="steps-grid" data-cols={plan.steps.length}>
    {#each plan.steps as s}
      <div class="step-block">
        <p class="step-title">ステップ {s.order}: <span class="stage-id">{s.stage.id}</span> {s.stage.name}</p>
        <p>目的: {s.purpose}</p>
        <h4>やること</h4>
        <ul>{#each s.actions as a}<li>{a}</li>{/each}</ul>
        <p class="print-omit">{s.pathNote}</p>
        <EvidenceLinks chapters={s.chapters} />
      </div>
    {/each}
    </div>
    <div class="sheet-grid two">
      <div>
        <h4>文化を 1 段上げる施策</h4>
        <p>
          <strong>{plan.culture.current.id} {plan.culture.current.name}</strong>
          から
          {#if plan.culture.target}<strong>{plan.culture.target.id} {plan.culture.target.name}</strong> へ{:else}最上位に到達しているため、維持と点検へ{/if}
        </p>
        <ul>{#each plan.culture.measures as m}<li>{m}</li>{/each}</ul>
        <EvidenceLinks chapters={['36-culture-formation']} evidence={['jcurve', 'rogers-diffusion']} />
      </div>
      <div>
        <h4>道筋別の手</h4>
        <p class="term">後悔しない手(どの道筋でも必要)</p>
        <ul>{#each plan.moves.noRegret as m}<li>{m}</li>{/each}</ul>
        <p class="term">選択権を買う手(小さく投資して将来の選択肢を残す)</p>
        <ul>{#each plan.moves.option as m}<li>{m}</li>{/each}</ul>
        <p class="term">賭ける手(道筋が当たったときに大きく効く)</p>
        {#if plan.moves.bet.length === 0}
          <p>道筋を選んでから検討します。</p>
        {:else}
          <ul>{#each plan.moves.bet as m}<li>{m}</li>{/each}</ul>
        {/if}
        {#if plan.moves.caution}<p class="note">{plan.moves.caution}</p>{/if}
        <EvidenceLinks chapters={['35-strategy-by-path']} evidence={['gartner-agentic-2025', 'mckinsey-2025']} />
      </div>
    </div>
  {:else}
    <p>現在地診断と道筋の選択を終えると、ここにステップが表示されます。</p>
  {/if}

  <h3>{H[4]}</h3>
  <p class="term">運営モデル</p>
  {#if plan}
    <ul>
      {#each plan.steps as s}
        <li>ステップ {s.order}({s.stage.id}): <strong>{s.operatingModel.code} {s.operatingModel.name}</strong> ── {s.operatingModel.definition}。<span class="print-omit">{s.operatingModelReason}</span></li>
      {/each}
    </ul>
  {:else}
    <p>次の一手が決まると表示されます。</p>
  {/if}
  {@render noteField(4, '責任を負う役員、推進の担い手')}
  <EvidenceLinks chapters={['33-operating-model-evolution']} />

  <h3>{H[5]}</h3>
  {#if plan}
    <div class="steps-grid" data-cols={plan.steps.length}>
    {#each plan.steps as s}
      <div class="step-block">
        <p class="step-title">ステップ {s.order}: <span class="stage-id">{s.stage.id}</span> {s.stage.name}</p>
        <dl class="req">
          <dt>人材</dt><dd>{s.requirements.people}</dd>
          <dt>データ</dt><dd>{s.requirements.data}</dd>
          <dt>統治</dt><dd>{s.requirements.governance}</dd>
          <dt>評価</dt><dd>{s.requirements.evaluation}</dd>
          <dt>費用</dt><dd>{s.requirements.cost}</dd>
          <dt>層</dt><dd><ul class="tag-list">{#each s.layers as l}<li>{l.id} {l.name}</li>{/each}</ul></dd>
        </dl>
      </div>
    {/each}
    </div>
    <EvidenceLinks chapters={['34-requirements-and-providers', '18-market-map']} />
  {:else}
    <p>次の一手が決まると表示されます。</p>
  {/if}

  <h3>{H[6]}</h3>
  {@render noteField(6)}
  <EvidenceLinks chapters={SHEET_SECTIONS[6].chapters} />

  <h3>{H[7]}</h3>
  {#if governance}
    <p class="term">{governance.stage.id} {governance.stage.name} に合わせた最低限</p>
    <dl class="req gov">
      {#each governance.items as it}
        <dt>{it.label}</dt><dd>{it.text}</dd>
      {/each}
    </dl>
    <EvidenceLinks chapters={['37-launching-ax-project', '17-governance-regulation']} />
  {:else}
    <p>現在地診断を終えると表示されます。</p>
  {/if}

  <h3>{H[8]}</h3>
  {@render noteField(8)}
  <EvidenceLinks chapters={SHEET_SECTIONS[8].chapters} />

  <h3>{H[9]}</h3>
  {@render noteField(9)}
  <p class="term no-print">決めなかったことを書かない資料は、決めたことの範囲が分からなくなります(本 第38章)。記入欄は端末への保存・JSON・Markdown・印刷に含まれ、共有用の URL には含まれません。</p>

  {#if selectedConcerns.length > 0}
    <h3>補足: 悩みと対応</h3>
    <div class="steps-grid" data-cols={Math.min(3, selectedConcerns.length >= 4 ? 3 : selectedConcerns.length)}>
    {#each selectedConcerns as c}
      <div class="step-block">
        <p class="step-title">{c.label}</p>
        <p>{c.step}</p>
        <p class="term print-omit">関係する軸: {c.axes.map(axisShort).join('、')}</p>
        <EvidenceLinks chapters={c.chapters} evidence={c.evidence} />
      </div>
    {/each}
    </div>
  {/if}

  {#if referencedEvidence.length > 0}
    <h3 class="refs">この資料で参照した一次資料</h3>
    <ul class="evidence-list refs">
      {#each referencedEvidence as e}
        <li><a href={e.url} target="_blank" rel="noopener">{e.label}<span class="visually-hidden">(新しいタブで開く)</span></a>({e.publisher}、{e.date})</li>
      {/each}
    </ul>
  {/if}
  <p class="meta">AXコンパス(https://takenori-kusaka.github.io/ax-compass/)で作成。このアプリと本は生成AIを使って作成し、著者が内容を確認して公開しています。</p>
</article>

<div class="actions no-print">
  <button type="button" class="btn" onclick={() => (app.step = 3)}>戻る</button>
  <button type="button" class="btn" onclick={() => (app.step = 1)}>診断をやり直す</button>
</div>
