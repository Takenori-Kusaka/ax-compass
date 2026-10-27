// AX コンパスのロジック本体。診断の集計、ステップ論の生成、Markdown、URL の符号化。
// 純関数だけを置く(DOM や localStorage に触れない)。Svelte からも node --test からも同じ関数を使うため、
// TypeScript ではなく JSDoc つきの JS にしている。
// @ts-check

/** @typedef {'A'|'B'|'C'|'undecided'} PathId */
/** @typedef {{ business: Record<string, string>, adoption: Record<string, number>, culture: Record<string, number> }} Answers */
/** @typedef {{ version: 1, step: number, answers: Answers, path: PathId | null, concerns: string[] }} AppState */

/** @typedef {{ id: string, text: string, options: { value: string | number, label: string }[] }} Question */
/** @typedef {{ id: string, label: string, intro: string, questions: Question[] }} Axis */
/** @typedef {{ axes: Axis[] }} QuestionSet */

/** @typedef {{ id: string, name: string, short: string, definition: string, aiFocus: string }} BusinessPhase */
/** @typedef {{ people: string, data: string, governance: string, evaluation: string, cost: string }} Requirements */
/** @typedef {{ id: string, level: number, name: string, definition: string, typical: string, purpose: string, actions: string[], requirements: Requirements, layers: string[], operatingModel: string }} AdoptionStage */
/** @typedef {{ id: string, level: number, name: string, definition: string, next: string[] }} CultureStage */
/** @typedef {{ id: string, name: string, definition: string, fitsFor: string }} OperatingModel */
/** @typedef {{ id: string, name: string, examples: string }} Layer */
/** @typedef {{ noRegret: string[], option: string[], bet: string[] }} Moves */
/** @typedef {{ id: string, name: string, short: string, chapter: string, premise: string, image2029: string, indicators: string[], moves: Moves }} Path */
/**
 * @typedef {{
 *   book: { title: string, baseUrl: string, chapters: Record<string, string> },
 *   business: { label: string, description: string, chapter: string, phases: BusinessPhase[] },
 *   adoption: { label: string, description: string, chapter: string, stages: AdoptionStage[] },
 *   culture: { label: string, description: string, chapter: string, stages: CultureStage[] },
 *   operatingModels: OperatingModel[],
 *   layers: Layer[],
 *   paths: Path[],
 *   undecided: { id: string, name: string, short: string, chapter: string, premise: string, image2029: string, indicators: string[] },
 *   autonomy: { id: string, name: string, definition: string }[]
 * }} Framework
 */

/** @typedef {{ id: string, label: string, axes: string[], step: string, chapters: string[], evidence: string[] }} Concern */
/** @typedef {{ id: string, label: string, url: string, publisher: string, date: string }} Evidence */

/**
 * @typedef {{
 *   business: { phase: BusinessPhase | null, counts: Record<string, number>, answered: number, total: number },
 *   adoption: { level: number | null, mean: number | null, answered: number, total: number, stage: AdoptionStage | null },
 *   culture: { level: number | null, mean: number | null, answered: number, total: number, stage: CultureStage | null },
 *   complete: boolean
 * }} Diagnosis
 */

/**
 * @typedef {{
 *   id: string, order: number, stage: AdoptionStage, purpose: string, actions: string[], requirements: Requirements,
 *   layers: Layer[], operatingModel: OperatingModel, operatingModelReason: string, pathNote: string, chapters: string[]
 * }} Step
 */
/**
 * @typedef {{
 *   pathId: PathId, pathName: string, horizon: string,
 *   steps: Step[],
 *   moves: { noRegret: string[], option: string[], bet: string[], caution: string | null },
 *   culture: { current: CultureStage, target: CultureStage | null, measures: string[] },
 *   businessNote: string
 * }} Plan
 */

export const STATE_VERSION = 1;
const PATH_IDS = /** @type {PathId[]} */ (['A', 'B', 'C', 'undecided']);

/** @returns {AppState} */
export function createState() {
  return { version: STATE_VERSION, step: 0, answers: { business: {}, adoption: {}, culture: {} }, path: null, concerns: [] };
}

// ---------------------------------------------------------------------------
// 診断の集計

/**
 * 数値段階の軸(導入 S1〜S6、文化 C1〜C5)。回答の平均を四捨五入して段階にする。
 * 段階は累積的ではなく「目安」なので、最大値ではなく平均を使う(1 問だけ高い回答で段階が跳ねないようにする)。
 * @param {Axis} axis
 * @param {Record<string, number>} answers
 */
export function scoreLevelAxis(axis, answers) {
  const values = axis.questions.map((q) => answers[q.id]).filter((v) => typeof v === 'number' && Number.isFinite(v));
  const total = axis.questions.length;
  if (values.length === 0) return { level: null, mean: null, answered: 0, total };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...axis.questions.flatMap((q) => q.options.map((o) => Number(o.value))));
  const level = Math.min(max, Math.max(1, Math.round(mean)));
  return { level, mean, answered: values.length, total };
}

/**
 * 事業フェーズ。選択肢ごとの票数で決め、同数なら最初の設問(売上の動き)の回答を優先する。
 * @param {Axis} axis
 * @param {Record<string, string>} answers
 * @param {BusinessPhase[]} phases
 */
export function scoreBusiness(axis, answers, phases) {
  /** @type {Record<string, number>} */
  const counts = Object.fromEntries(phases.map((p) => [p.id, 0]));
  let answered = 0;
  for (const q of axis.questions) {
    const v = answers[q.id];
    if (typeof v === 'string' && v in counts) { counts[v] += 1; answered += 1; }
  }
  const total = axis.questions.length;
  if (answered === 0) return { phase: null, counts, answered, total };
  const best = Math.max(...Object.values(counts));
  const tied = phases.filter((p) => counts[p.id] === best);
  const first = answers[axis.questions[0].id];
  const phase = tied.find((p) => p.id === first) ?? tied[0];
  return { phase, counts, answered, total };
}

/**
 * @param {Framework} framework
 * @param {QuestionSet} questions
 * @param {Answers} answers
 * @returns {Diagnosis}
 */
export function diagnose(framework, questions, answers) {
  const axis = (/** @type {string} */ id) => {
    const a = questions.axes.find((x) => x.id === id);
    if (!a) throw new Error(`questions.json に軸 ${id} がありません`);
    return a;
  };
  const b = scoreBusiness(axis('business'), answers.business, framework.business.phases);
  const s = scoreLevelAxis(axis('adoption'), answers.adoption);
  const c = scoreLevelAxis(axis('culture'), answers.culture);
  const complete = b.answered === b.total && s.answered === s.total && c.answered === c.total;
  return {
    business: b,
    adoption: { ...s, stage: s.level ? framework.adoption.stages[s.level - 1] : null },
    culture: { ...c, stage: c.level ? framework.culture.stages[c.level - 1] : null },
    complete,
  };
}

// ---------------------------------------------------------------------------
// ステップ論

/** 道筋ごとに、いくつ先の段階まで示すか。加速は遠くまで、調整は 1 段だけ */
const STEPS_BY_PATH = { A: 3, B: 2, C: 1, undecided: 2 };
const HORIZON_BY_PATH = {
  A: '2027 年まで(四半期ごとに次の段階へ進むかを判断)',
  B: '2029 年まで(手順とデータの整備を先行させ、段階を飛ばさない)',
  C: '2027 年まで(各ステップに撤退条件と費用の上限を添える)',
  undecided: '次の四半期まで(1 段進めた時点で道筋を見直す)',
};
const PATH_NOTE = {
  A: '加速の道筋では期間を短く取り、評価の仕組みを先に置いて次の段階へ進む判断を速くします。',
  B: '漸進の道筋では、このステップで手順とデータの整備を終えてから次へ進みます。',
  C: '調整の道筋では、このステップに費用の上限と撤退条件を添え、特定事業者に依存しない形で進めます。',
  undecided: 'どの道筋でも後悔しない手を優先し、このステップを終えた時点で早期警戒指標を見て道筋を選びます。',
};

/**
 * @param {Framework} framework
 * @param {string} id
 */
function opModel(framework, id) {
  const m = framework.operatingModels.find((x) => x.id === id);
  if (!m) throw new Error(`framework.json に運営モデル ${id} がありません`);
  return m;
}

/**
 * 運営モデルは段階の既定値を事業フェーズで調整する。
 * 新規事業は S4 以降を製品組織で持つ方が速い。再生は S3 から事業部へ権限を渡す(既存の IT 部門に集めると転換が遅れる)。
 * @param {Framework} framework
 * @param {AdoptionStage} stage
 * @param {BusinessPhase | null} phase
 */
function chooseOperatingModel(framework, stage, phase) {
  let id = stage.operatingModel;
  let reason = `${stage.id} の既定の運営モデルです。`;
  if (phase?.id === 'explore' && stage.level >= 4) {
    id = 'product';
    reason = '新規事業(探索)では、AI を製品の一部として製品組織が運用する方が、CoE を経由するより判断が速いためです。';
  } else if (phase?.id === 'renew' && stage.level === 3) {
    id = 'hub-spoke';
    reason = '再生(構造転換)では、既存の IT 部門に集めると転換が遅れるため、早い段階で事業部に用途の権限を渡します。';
  } else if (phase?.id === 'mature' && stage.level === 5) {
    id = 'hub-spoke';
    reason = '成熟(効率)では、統治と費用管理を CoE に残したまま製品化を進める方が、分散より事故が少ないためです。';
  }
  return { model: opModel(framework, id), reason };
}

/**
 * 現在地 × 道筋 から次のステップを作る。必ず 1 つ以上返す。
 * @param {Framework} framework
 * @param {{ business: BusinessPhase | null, adoption: number, culture: number }} position
 * @param {PathId} pathId
 * @returns {Plan}
 */
export function buildPlan(framework, position, pathId) {
  if (!PATH_IDS.includes(pathId)) throw new Error(`道筋 ${pathId} は未定義です`);
  const stages = framework.adoption.stages;
  const level = Math.min(stages.length, Math.max(1, Math.round(position.adoption)));
  const count = STEPS_BY_PATH[pathId];
  const layerOf = (/** @type {string} */ id) => {
    const l = framework.layers.find((x) => x.id === id);
    if (!l) throw new Error(`framework.json に層 ${id} がありません`);
    return l;
  };

  /** @type {Step[]} */
  const steps = [];
  for (let lv = level + 1; lv <= Math.min(stages.length, level + count); lv += 1) {
    const stage = stages[lv - 1];
    const { model, reason } = chooseOperatingModel(framework, stage, position.business);
    steps.push({
      id: stage.id,
      order: steps.length + 1,
      stage,
      purpose: stage.purpose,
      actions: stage.actions,
      requirements: stage.requirements,
      layers: stage.layers.map(layerOf),
      operatingModel: model,
      operatingModelReason: reason,
      pathNote: PATH_NOTE[pathId],
      chapters: ['30-genai-adoption-stages', '34-requirements-and-providers', '33-operating-model-evolution'],
    });
  }
  if (steps.length === 0) {
    // S6 に到達している。段階を上げる代わりに、自律性と範囲を広げるステップを 1 つ示す
    const stage = stages[stages.length - 1];
    const { model, reason } = chooseOperatingModel(framework, stage, position.business);
    steps.push({
      id: `${stage.id}+`,
      order: 1,
      stage,
      purpose: 'S6 に到達しています。段階を上げる代わりに、AI が完結する取引の範囲と自律性(A3 から A4 へ)を、事故の件数を見ながら広げます。',
      actions: [
        '完結率と人へ戻した率を四半期ごとに見直し、自律実行の範囲を 1 つずつ広げる',
        '複数エージェントの協調(A4)を、金額の小さい取引で試す',
        '計算資源の調達を複数の事業者に分け、価格と供給の変動に備える',
        '規制の変更を監視し、自律実行の範囲の明文化を更新する',
      ],
      requirements: stage.requirements,
      layers: stage.layers.map(layerOf),
      operatingModel: model,
      operatingModelReason: reason,
      pathNote: PATH_NOTE[pathId],
      chapters: ['31-agent-adoption-stages', '34-requirements-and-providers'],
    });
  }

  // 道筋別の手。未決の場合は 3 つの道筋に共通する「後悔しない手」と「選択権を買う手」を集め、「賭ける手」は出さない
  /** @type {{ noRegret: string[], option: string[], bet: string[], caution: string | null }} */
  let moves;
  let pathName;
  if (pathId === 'undecided') {
    const uniq = (/** @type {string[]} */ xs) => Array.from(new Set(xs));
    moves = {
      noRegret: uniq(framework.paths.flatMap((p) => p.moves.noRegret)),
      option: uniq(framework.paths.flatMap((p) => p.moves.option)),
      bet: [],
      caution: '賭ける手は、道筋を選んでから検討します。早期警戒指標を四半期ごとに確認し、分岐が見えた時点で選びます。',
    };
    pathName = framework.undecided.name;
  } else {
    const p = framework.paths.find((x) => x.id === pathId);
    if (!p) throw new Error(`framework.json に道筋 ${pathId} がありません`);
    moves = {
      ...p.moves,
      caution: level <= 2 ? '現在地が S2 以下のため、賭ける手は S3(仕事に組み込む)に到達してから検討します。手順と評価の仕組みがない段階で賭けると、効果を測れません。' : null,
    };
    pathName = p.name;
  }

  const cLevel = Math.min(framework.culture.stages.length, Math.max(1, Math.round(position.culture)));
  const current = framework.culture.stages[cLevel - 1];
  const target = framework.culture.stages[cLevel] ?? null;

  const businessNote = position.business ? position.business.aiFocus : '事業フェーズが未回答のため、事業フェーズによる調整は行っていません。';

  return { pathId, pathName, horizon: HORIZON_BY_PATH[pathId], steps, moves, culture: { current, target, measures: current.next }, businessNote };
}

// ---------------------------------------------------------------------------
// 悩みの整理

/**
 * 選んだ悩みに、推奨ステップと本の章を対応づける。
 * @param {Concern[]} concerns
 * @param {string[]} selectedIds
 */
export function concernReport(concerns, selectedIds) {
  const order = new Map(concerns.map((c, i) => [c.id, i]));
  return selectedIds
    .filter((id) => order.has(id))
    .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    .map((id) => /** @type {Concern} */ (concerns.find((c) => c.id === id)));
}

// ---------------------------------------------------------------------------
// Markdown

/**
 * @param {Framework} framework
 * @param {string} slug
 */
export function chapterUrl(framework, slug) {
  return `${framework.book.baseUrl}${slug}`;
}

/**
 * @param {Framework} framework
 * @param {string} slug
 */
export function chapterTitle(framework, slug) {
  return framework.book.chapters[slug] ?? slug;
}

/**
 * 会議体向け 1 枚資料の Markdown。画面の結果と同じ内容を、順序も同じに出す。
 * @param {{ framework: Framework, questions: QuestionSet, concerns: Concern[], evidence: Evidence[] }} data
 * @param {AppState} state
 */
export function toMarkdown(data, state) {
  const { framework, questions, concerns, evidence } = data;
  const d = diagnose(framework, questions, state.answers);
  const lines = [];
  const link = (/** @type {string} */ slug) => `[${chapterTitle(framework, slug)}](${chapterUrl(framework, slug)})`;
  lines.push('# AX コンパス ── 現在地と次のステップ');
  lines.push('');
  lines.push('自己申告に基づく目安です。段階の定義は『AIトランスフォーメーションの設計図』第Ⅴ部に従います。');
  lines.push('');
  lines.push('## 現在地');
  lines.push('');
  lines.push('| 軸 | 現在地 | 定義 |');
  lines.push('| --- | --- | --- |');
  lines.push(`| 事業フェーズ | ${d.business.phase ? d.business.phase.name : '未回答'} | ${d.business.phase ? d.business.phase.definition : ''} |`);
  lines.push(`| 導入フェーズ | ${d.adoption.stage ? `${d.adoption.stage.id} ${d.adoption.stage.name}` : '未回答'} | ${d.adoption.stage ? d.adoption.stage.definition : ''} |`);
  lines.push(`| 文化フェーズ | ${d.culture.stage ? `${d.culture.stage.id} ${d.culture.stage.name}` : '未回答'} | ${d.culture.stage ? d.culture.stage.definition : ''} |`);
  lines.push('');
  lines.push(`根拠: ${link('32-three-positions')}`);
  lines.push('');

  const pathId = state.path;
  const path = pathId && pathId !== 'undecided' ? framework.paths.find((p) => p.id === pathId) : null;
  lines.push('## 目指す道筋');
  lines.push('');
  if (!pathId) {
    lines.push('未選択');
  } else if (path) {
    lines.push(`**${path.name}**`);
    lines.push('');
    lines.push(`- 前提: ${path.premise}`);
    lines.push(`- 2029 年の像: ${path.image2029}`);
    lines.push(`- 早期警戒指標: ${path.indicators.join('、')}`);
    lines.push('');
    lines.push(`根拠: ${link(path.chapter)}、${link('29-paths-comparison-indicators')}`);
  } else {
    lines.push(`**${framework.undecided.name}**`);
    lines.push('');
    lines.push(`- ${framework.undecided.premise}`);
    lines.push(`- ${framework.undecided.image2029}`);
    lines.push('');
    lines.push(`根拠: ${link(framework.undecided.chapter)}`);
  }
  lines.push('');

  if (pathId && d.adoption.level && d.culture.level) {
    const plan = buildPlan(framework, { business: d.business.phase, adoption: d.adoption.level, culture: d.culture.level }, pathId);
    lines.push('## 次のステップ');
    lines.push('');
    lines.push(`期間の目安: ${plan.horizon}`);
    lines.push('');
    lines.push(`事業フェーズからの見方: ${plan.businessNote}`);
    lines.push('');
    for (const s of plan.steps) {
      lines.push(`### ステップ ${s.order}: ${s.stage.id} ${s.stage.name}`);
      lines.push('');
      lines.push(`目的: ${s.purpose}`);
      lines.push('');
      lines.push('やること:');
      for (const a of s.actions) lines.push(`- ${a}`);
      lines.push('');
      lines.push('必要なもの:');
      lines.push(`- 人材: ${s.requirements.people}`);
      lines.push(`- データ: ${s.requirements.data}`);
      lines.push(`- 統治: ${s.requirements.governance}`);
      lines.push(`- 評価: ${s.requirements.evaluation}`);
      lines.push(`- 費用: ${s.requirements.cost}`);
      lines.push('');
      lines.push(`関わる提供事業者の層: ${s.layers.map((l) => `${l.id} ${l.name}`).join('、')}`);
      lines.push('');
      lines.push(`運営モデル: ${s.operatingModel.name}(${s.operatingModelReason})`);
      lines.push('');
      lines.push(s.pathNote);
      lines.push('');
      lines.push(`根拠: ${s.chapters.map(link).join('、')}`);
      lines.push('');
    }
    lines.push('## 道筋別の手');
    lines.push('');
    lines.push('後悔しない手:');
    for (const m of plan.moves.noRegret) lines.push(`- ${m}`);
    lines.push('');
    lines.push('選択権を買う手:');
    for (const m of plan.moves.option) lines.push(`- ${m}`);
    lines.push('');
    lines.push('賭ける手:');
    if (plan.moves.bet.length === 0) lines.push('- (道筋を選んでから検討)');
    for (const m of plan.moves.bet) lines.push(`- ${m}`);
    if (plan.moves.caution) { lines.push(''); lines.push(`注意: ${plan.moves.caution}`); }
    lines.push('');
    lines.push(`根拠: ${link('35-strategy-by-path')}`);
    lines.push('');
    lines.push('## 文化を 1 段上げる施策');
    lines.push('');
    lines.push(`${plan.culture.current.id} ${plan.culture.current.name} → ${plan.culture.target ? `${plan.culture.target.id} ${plan.culture.target.name}` : '最上位に到達(維持)'}`);
    lines.push('');
    for (const m of plan.culture.measures) lines.push(`- ${m}`);
    lines.push('');
    lines.push(`根拠: ${link('36-culture-formation')}`);
    lines.push('');
  }

  const selected = concernReport(concerns, state.concerns);
  if (selected.length > 0) {
    lines.push('## 悩みと対応');
    lines.push('');
    for (const c of selected) {
      lines.push(`### ${c.label}`);
      lines.push('');
      lines.push(c.step);
      lines.push('');
      lines.push(`根拠: ${c.chapters.map(link).join('、')}`);
      const ev = c.evidence.map((id) => evidence.find((e) => e.id === id)).filter((e) => !!e);
      for (const e of ev) lines.push(`- ${e.label}(${e.publisher}、${e.date}) ${e.url}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('AX コンパス(https://takenori-kusaka.github.io/ax-compass/)で作成。このアプリと本は生成AIを使って作成し、著者が内容を確認して公開しています。');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 保存と共有

/**
 * 回答の検証。外部から読み込む JSON と URL は信用せず、形と値域を確かめてから使う。
 * @param {unknown} raw
 * @param {QuestionSet} questions
 * @returns {AppState | null}
 */
export function parseState(raw, questions) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const state = createState();
  const answers = /** @type {Record<string, unknown>} */ (o.answers && typeof o.answers === 'object' ? o.answers : {});
  for (const axis of questions.axes) {
    const src = /** @type {Record<string, unknown>} */ (answers[axis.id] && typeof answers[axis.id] === 'object' ? answers[axis.id] : {});
    for (const q of axis.questions) {
      const v = src[q.id];
      if (q.options.some((opt) => opt.value === v)) {
        if (axis.id === 'business') state.answers.business[q.id] = /** @type {string} */ (v);
        else if (axis.id === 'adoption') state.answers.adoption[q.id] = /** @type {number} */ (v);
        else if (axis.id === 'culture') state.answers.culture[q.id] = /** @type {number} */ (v);
      }
    }
  }
  if (typeof o.path === 'string' && PATH_IDS.includes(/** @type {PathId} */ (o.path))) state.path = /** @type {PathId} */ (o.path);
  if (Array.isArray(o.concerns)) state.concerns = o.concerns.filter((c) => typeof c === 'string').slice(0, 50);
  if (typeof o.step === 'number' && Number.isInteger(o.step) && o.step >= 0 && o.step <= 4) state.step = o.step;
  return state;
}

/**
 * URL のハッシュ用の短い形。設問の順に選択肢の添字を並べる(未回答は -1)。
 * @param {AppState} state
 * @param {QuestionSet} questions
 */
export function encodeState(state, questions) {
  /** @type {Record<string, number[]>} */
  const a = {};
  for (const axis of questions.axes) {
    const all = /** @type {Record<string, Record<string, string | number>>} */ (state.answers);
    const src = all[axis.id] ?? {};
    a[axis.id] = axis.questions.map((q) => q.options.findIndex((opt) => opt.value === src[q.id]));
  }
  const compact = { v: STATE_VERSION, a, p: state.path, k: state.concerns };
  return toBase64Url(JSON.stringify(compact));
}

/**
 * @param {string} encoded
 * @param {QuestionSet} questions
 * @returns {AppState | null}
 */
export function decodeState(encoded, questions) {
  let compact;
  try {
    compact = JSON.parse(fromBase64Url(encoded));
  } catch {
    return null;
  }
  if (!compact || typeof compact !== 'object' || compact.v !== STATE_VERSION) return null;
  const raw = { answers: /** @type {Record<string, Record<string, string | number>>} */ ({}), path: compact.p, concerns: compact.k, step: 4 };
  for (const axis of questions.axes) {
    const idx = Array.isArray(compact.a?.[axis.id]) ? compact.a[axis.id] : [];
    raw.answers[axis.id] = {};
    axis.questions.forEach((q, i) => {
      const opt = q.options[idx[i]];
      if (opt) raw.answers[axis.id][q.id] = opt.value;
    });
  }
  return parseState(raw, questions);
}

/** @param {string} text */
function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} b64 */
function fromBase64Url(b64) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
