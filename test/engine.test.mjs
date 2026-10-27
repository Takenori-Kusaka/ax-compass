// engine.mjs の検証。集計の境界、全組み合わせでステップが出ること、Markdown の内容、URL の往復。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import framework from '../src/data/framework.json' with { type: 'json' };
import questions from '../src/data/questions.json' with { type: 'json' };
import concernsData from '../src/data/concerns.json' with { type: 'json' };
import evidenceData from '../src/data/evidence.json' with { type: 'json' };
import { buildPlan, concernReport, createState, decodeState, diagnose, encodeState, parseState, scoreBusiness, scoreLevelAxis, toMarkdown } from '../src/lib/engine.mjs';

const data = { framework, questions, concerns: concernsData.items, evidence: evidenceData.items };
const axis = (id) => questions.axes.find((a) => a.id === id);
const PATHS = ['A', 'B', 'C', 'undecided'];

/** 全設問に同じ段階の選択肢で答える */
function answerAll(level) {
  const answers = { business: {}, adoption: {}, culture: {} };
  for (const q of axis('adoption').questions) answers.adoption[q.id] = Math.min(level, 6);
  for (const q of axis('culture').questions) answers.culture[q.id] = Math.min(level, 5);
  for (const q of axis('business').questions) answers.business[q.id] = 'growth';
  return answers;
}

test('データの整合: 設問の選択肢が段階の範囲に収まり、章の slug が対応表にある', () => {
  for (const q of axis('adoption').questions) assert.deepEqual(q.options.map((o) => o.value), [1, 2, 3, 4, 5, 6], q.id);
  for (const q of axis('culture').questions) assert.deepEqual(q.options.map((o) => o.value), [1, 2, 3, 4, 5], q.id);
  const phaseIds = framework.business.phases.map((p) => p.id);
  for (const q of axis('business').questions) assert.deepEqual(q.options.map((o) => o.value), phaseIds, q.id);
  for (const a of questions.axes) assert.ok(a.questions.length >= 5 && a.questions.length <= 7, `${a.id} は 5〜7 問`);
  for (const c of concernsData.items) {
    for (const slug of c.chapters) assert.ok(framework.book.chapters[slug], `${c.id}: 章 ${slug} が対応表にない`);
    for (const e of c.evidence) assert.ok(evidenceData.items.some((x) => x.id === e), `${c.id}: 根拠 ${e} が evidence.json にない`);
  }
  assert.ok(concernsData.items.length >= 12 && concernsData.items.length <= 20);
  for (const s of framework.adoption.stages) for (const l of s.layers) assert.ok(framework.layers.some((x) => x.id === l), `${s.id}: 層 ${l}`);
  for (const s of framework.adoption.stages) assert.ok(framework.operatingModels.some((m) => m.id === s.operatingModel), `${s.id}: 運営モデル`);
});

test('集計の境界: 平均の四捨五入と上限・下限', () => {
  const s = axis('adoption');
  assert.equal(scoreLevelAxis(s, {}).level, null);
  assert.equal(scoreLevelAxis(s, { s1: 1 }).level, 1);
  assert.equal(scoreLevelAxis(s, { s1: 6, s2: 6, s3: 6, s4: 6, s5: 6, s6: 6 }).level, 6);
  // 平均 2.5 → 3(四捨五入)、平均 2.4 → 2
  assert.equal(scoreLevelAxis(s, { s1: 2, s2: 3 }).level, 3);
  assert.equal(scoreLevelAxis(s, { s1: 2, s2: 2, s3: 2, s4: 2, s5: 2, s6: 4 }).level, 2);
  assert.equal(scoreLevelAxis(s, { s1: 1, s2: 6 }).answered, 2);
  const c = axis('culture');
  assert.equal(scoreLevelAxis(c, { c1: 5, c2: 5, c3: 5, c4: 5, c5: 5, c6: 5 }).level, 5);
});

test('事業フェーズ: 多数決と、同数なら最初の設問を優先', () => {
  const b = axis('business');
  const phases = framework.business.phases;
  assert.equal(scoreBusiness(b, {}, phases).phase, null);
  assert.equal(scoreBusiness(b, { b1: 'mature', b2: 'mature', b3: 'growth' }, phases).phase.id, 'mature');
  assert.equal(scoreBusiness(b, { b1: 'renew', b2: 'growth' }, phases).phase.id, 'renew');
  assert.equal(scoreBusiness(b, { b2: 'growth', b3: 'explore' }, phases).phase.id, 'explore', '最初の設問が未回答なら順序の早い方');
});

test('diagnose: 完了判定', () => {
  const d1 = diagnose(framework, questions, createState().answers);
  assert.equal(d1.complete, false);
  assert.equal(d1.adoption.stage, null);
  const d2 = diagnose(framework, questions, answerAll(3));
  assert.equal(d2.complete, true);
  assert.equal(d2.adoption.stage.id, 'S3');
  assert.equal(d2.culture.stage.id, 'C3');
  assert.equal(d2.business.phase.id, 'growth');
});

test('各現在地 × 道筋で必ず 1 つ以上のステップが出る', () => {
  const phases = [...framework.business.phases, null];
  for (const business of phases) {
    for (let adoption = 1; adoption <= 6; adoption += 1) {
      for (let culture = 1; culture <= 5; culture += 1) {
        for (const pathId of PATHS) {
          const plan = buildPlan(framework, { business, adoption, culture }, pathId);
          const label = `${business?.id ?? 'none'}/S${adoption}/C${culture}/${pathId}`;
          assert.ok(plan.steps.length >= 1, label);
          for (const s of plan.steps) {
            assert.ok(s.actions.length >= 1 && s.layers.length >= 1 && s.operatingModel.name, label);
            assert.ok(s.requirements.people && s.requirements.cost, label);
          }
          assert.ok(plan.moves.noRegret.length >= 1 && plan.moves.option.length >= 1, label);
          assert.ok(plan.culture.measures.length >= 1, label);
          if (pathId === 'undecided') assert.equal(plan.moves.bet.length, 0, label);
          else assert.ok(plan.moves.bet.length >= 1, label);
          if (adoption < 6) assert.equal(plan.steps[0].stage.level, adoption + 1, label);
          else assert.equal(plan.steps[0].id, 'S6+', label);
        }
      }
    }
  }
});

test('ステップ数は道筋で変わり、S6 を超えない', () => {
  assert.equal(buildPlan(framework, { business: null, adoption: 1, culture: 1 }, 'A').steps.length, 3);
  assert.equal(buildPlan(framework, { business: null, adoption: 1, culture: 1 }, 'B').steps.length, 2);
  assert.equal(buildPlan(framework, { business: null, adoption: 1, culture: 1 }, 'C').steps.length, 1);
  assert.equal(buildPlan(framework, { business: null, adoption: 5, culture: 1 }, 'A').steps.length, 1);
  assert.equal(buildPlan(framework, { business: null, adoption: 1, culture: 5 }, 'A').culture.target, null);
});

test('運営モデルは事業フェーズで調整される', () => {
  const explore = framework.business.phases.find((p) => p.id === 'explore');
  const plan = buildPlan(framework, { business: explore, adoption: 3, culture: 3 }, 'A');
  assert.equal(plan.steps[0].stage.id, 'S4');
  assert.equal(plan.steps[0].operatingModel.id, 'product');
  const mature = framework.business.phases.find((p) => p.id === 'mature');
  assert.equal(buildPlan(framework, { business: mature, adoption: 3, culture: 3 }, 'A').steps[0].operatingModel.id, 'hub-spoke');
});

test('Markdown に現在地と道筋が含まれる', () => {
  const state = { ...createState(), answers: answerAll(2), path: 'B', concerns: ['roi', 'shadow-ai'] };
  const md = toMarkdown(data, state);
  assert.match(md, /S2 仕事に適用する/);
  assert.match(md, /C2 個人の試行/);
  assert.match(md, /成長/);
  assert.match(md, /道筋B：漸進/);
  assert.match(md, /ステップ 1: S3 仕事に組み込む/);
  assert.match(md, /ROI を説明できない/);
  assert.match(md, /zenn\.dev\/takenori_kusaka\/books\/ai-transformation-blueprint\/viewer\/35-strategy-by-path/);
  assert.match(md, /https:\/\/www\.mckinsey\.com/);
  assert.match(md, /生成AIを使って作成/);
  // 未決の場合は賭ける手を出さない
  const md2 = toMarkdown(data, { ...state, path: 'undecided' });
  assert.match(md2, /決めない/);
  assert.match(md2, /道筋を選んでから検討/);
  // 未回答でも落ちない
  const md3 = toMarkdown(data, createState());
  assert.match(md3, /未回答/);
});

test('URL の往復が一致する', () => {
  const state = { ...createState(), step: 4, answers: answerAll(4), path: 'C', concerns: ['roi', 'agent-meaning'] };
  state.answers.adoption.s6 = 1;
  delete state.answers.culture.c3;
  state.answers.business.b2 = 'renew';
  const encoded = encodeState(state, questions);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/, 'URL に安全な文字だけ');
  const back = decodeState(encoded, questions);
  assert.deepEqual(back.answers, state.answers);
  assert.equal(back.path, 'C');
  assert.deepEqual(back.concerns, state.concerns);
  assert.equal(decodeState('not-base64!!', questions), null);
  assert.equal(decodeState('', questions), null);
});

test('parseState は不正な値を捨てる', () => {
  const s = parseState({ answers: { adoption: { s1: 99, s2: 3 }, business: { b1: 'nope', b2: 'growth' } }, path: 'Z', concerns: ['roi', 5], step: 9 }, questions);
  assert.deepEqual(s.answers.adoption, { s2: 3 });
  assert.deepEqual(s.answers.business, { b2: 'growth' });
  assert.equal(s.path, null);
  assert.deepEqual(s.concerns, ['roi']);
  assert.equal(s.step, 0);
  assert.equal(parseState(null, questions), null);
  assert.equal(parseState('x', questions), null);
});

test('concernReport は定義順に並べ、未知の id を捨てる', () => {
  const r = concernReport(concernsData.items, ['roi', 'unknown', 'where-to-start']);
  assert.deepEqual(r.map((c) => c.id), ['where-to-start', 'roi']);
});
