// engine.mjs の検証。集計の境界、全組み合わせでステップが出ること、Markdown の内容、URL の往復。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import framework from '../src/data/framework.json' with { type: 'json' };
import questions from '../src/data/questions.json' with { type: 'json' };
import concernsData from '../src/data/concerns.json' with { type: 'json' };
import evidenceData from '../src/data/evidence.json' with { type: 'json' };
import { NOT_APPLICABLE, SHEET_HEADINGS, buildPlan, concernReport, createState, decodeState, diagnose, encodeState, governanceMinimum, parseState, scoreBusiness, scoreLevelAxis, toMarkdown, weakestAnswers, weakestSummary } from '../src/lib/engine.mjs';

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
  for (const q of axis('adoption').questions) {
    // 顧客向けの製品・サービスに関する 2 問(s5、s6)だけ「該当しない」(0)を持つ
    const expected = ['s5', 's6'].includes(q.id) ? [1, 2, 3, 4, 5, 6, NOT_APPLICABLE] : [1, 2, 3, 4, 5, 6];
    assert.deepEqual(q.options.map((o) => o.value), expected, q.id);
  }
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
  for (const s of framework.adoption.stages) {
    if (s.operatingModel !== null) assert.ok(framework.operatingModels.some((m) => m.id === s.operatingModel), `${s.id}: 運営モデル`);
    for (const k of ['guideline', 'data', 'identity', 'approval']) assert.ok(s.governanceMinimum?.[k], `${s.id}: 統治の最低限 ${k}`);
  }
  assert.equal(framework.adoption.stages[0].operatingModel, null, 'S1 は本の表(第33章)どおり運営モデルなし');
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

test('weakestAnswers: 最も低い答えの設問を、同点ならすべて設問の順に返す', () => {
  const s = axis('adoption');
  assert.deepEqual(weakestAnswers(s, {}), { level: null, items: [] });
  const w = weakestAnswers(s, { s1: 3, s2: 1, s3: 4, s4: 1, s5: 2, s6: 5 });
  assert.equal(w.level, 1);
  assert.deepEqual(w.items.map((x) => x.question.id), ['s2', 's4']);
  assert.equal(w.items[0].label, s.questions[1].options[0].label);
  assert.deepEqual(weakestAnswers(axis('culture'), { c3: 4 }).items.map((x) => x.question.id), ['c3']);
});

test('該当しない: 平均の計算から除外し、全問が該当しないなら S1、回答済みの数には含める', () => {
  const s = axis('adoption');
  // s5、s6 を 1 で答えると平均 3 → S3。「該当しない」にすると 4 問の平均 4 → S4
  assert.equal(scoreLevelAxis(s, { s1: 4, s2: 4, s3: 4, s4: 4, s5: 1, s6: 1 }).level, 3);
  const na = scoreLevelAxis(s, { s1: 4, s2: 4, s3: 4, s4: 4, s5: NOT_APPLICABLE, s6: NOT_APPLICABLE });
  assert.equal(na.level, 4);
  assert.equal(na.mean, 4);
  assert.equal(na.answered, 6, '「該当しない」も回答済みに数える(完了判定のため)');
  // 除外後に回答が 0 件なら S1
  assert.equal(scoreLevelAxis(s, { s5: NOT_APPLICABLE, s6: NOT_APPLICABLE }).level, 1);
  // 全問に答えれば完了になり、現在地は S4
  const d = diagnose(framework, questions, { business: answerAll(2).business, adoption: { s1: 4, s2: 4, s3: 4, s4: 4, s5: NOT_APPLICABLE, s6: NOT_APPLICABLE }, culture: answerAll(2).culture });
  assert.equal(d.complete, true);
  assert.equal(d.adoption.stage?.id, 'S4');
  // 共有 URL と JSON の往復でも残る
  const state = { ...createState(), answers: { ...answerAll(3), adoption: { s1: 3, s2: 3, s3: 3, s4: 3, s5: NOT_APPLICABLE, s6: NOT_APPLICABLE } } };
  assert.equal(decodeState(encodeState(state, questions), questions)?.answers.adoption.s5, NOT_APPLICABLE);
  assert.equal(parseState(JSON.parse(JSON.stringify(state)), questions)?.answers.adoption.s6, NOT_APPLICABLE);
});

test('該当しない: 最も低い答え(次に上げるべき場所)に出ない', () => {
  const s = axis('adoption');
  const w = weakestAnswers(s, { s1: 3, s2: 2, s3: 4, s4: 2, s5: NOT_APPLICABLE, s6: NOT_APPLICABLE });
  assert.equal(w.level, 2);
  assert.deepEqual(w.items.map((x) => x.question.id), ['s2', 's4']);
  // 「該当しない」以外が全て同点なら「全設問が同じ段階」(該当しない設問は数に入れない)
  const all = weakestSummary(s, { s1: 2, s2: 2, s3: 2, s4: 2, s5: NOT_APPLICABLE, s6: NOT_APPLICABLE });
  assert.equal(all.allSame, true);
  assert.match(all.text, /全設問が同じ段階\(S2\)/);
  // 該当しないしか無ければ、最も低い答えは無い
  assert.deepEqual(weakestAnswers(s, { s5: NOT_APPLICABLE }), { level: null, items: [] });
  assert.equal(weakestSummary(s, { s5: NOT_APPLICABLE }).text, '');
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
  assert.match(md, /AXコンパス ── 現在地と次のステップ/);
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
  const s = parseState({ version: 1, answers: { adoption: { s1: 99, s2: 3 }, business: { b1: 'nope', b2: 'growth' } }, path: 'Z', concerns: ['roi', 5], step: 9 }, questions);
  assert.deepEqual(s.answers.adoption, { s2: 3 });
  assert.deepEqual(s.answers.business, { b2: 'growth' });
  assert.equal(s.path, null);
  assert.deepEqual(s.concerns, ['roi']);
  assert.equal(s.step, 0);
  assert.equal(parseState(null, questions), null);
  assert.equal(parseState('x', questions), null);
});

test('parseState: 形の違う JSON は null(成功扱いにして直前の状態を消さない)', () => {
  assert.equal(parseState({ answers: 5, path: 'Z', step: 99 }, questions), null, 'version が無い');
  assert.equal(parseState({ version: 2, answers: answerAll(3) }, questions), null, 'version が違う');
  assert.equal(parseState({ version: 1, answers: { adoption: { s1: 99 } } }, questions), null, '認識できる回答が 1 つもない');
  assert.equal(parseState({ version: 1 }, questions), null, '回答が無い');
  assert.equal(parseState([], questions), null);
  // 正しい保存ファイル(savedAt などの余分な鍵があってもよい)
  const ok = parseState({ ...createState(), answers: answerAll(2), path: 'A', step: 4, openQuestions: 'いつ顧客接点に出すか', savedAt: '2026-10-28' }, questions);
  assert.ok(ok);
  assert.equal(ok.step, 4);
  assert.equal(ok.openQuestions, 'いつ顧客接点に出すか');
  // 自由記述は上限で切る。文字列以外は捨てる
  assert.equal(parseState({ version: 1, answers: answerAll(2), openQuestions: 'あ'.repeat(5000) }, questions).openQuestions.length, 2000);
  assert.equal(parseState({ version: 1, answers: answerAll(2), openQuestions: 42 }, questions).openQuestions, '');
});

test('共有 URL から復元した状態は結果画面(step 4)で、自由記述も往復する', () => {
  const state = { ...createState(), step: 2, answers: answerAll(3), path: 'B', concerns: ['roi'], openQuestions: '全員に配るかどうか\n取引先の条件' };
  const back = decodeState(encodeState(state, questions), questions);
  assert.ok(back);
  assert.equal(back.step, 4, 'ハッシュからの復元は結果画面に着地する');
  assert.deepEqual(back.answers, state.answers);
  assert.equal(back.path, 'B');
  assert.equal(back.openQuestions, state.openQuestions);
  // 自由記述が空なら URL に含めない(短く保つ)
  const short = encodeState({ ...state, openQuestions: '' }, questions);
  assert.ok(short.length < encodeState(state, questions).length);
  assert.equal(decodeState(short, questions).openQuestions, '');
  // 回答の無い状態は共有しても復元できない(null)。復元側は前回の続きに落ちる
  assert.equal(decodeState(encodeState(createState(), questions), questions), null);
});

test('Markdown に本の第38章の 8 つの見出しが順に含まれる', () => {
  assert.equal(SHEET_HEADINGS.length, 8);
  const state = { ...createState(), answers: answerAll(2), path: 'B', concerns: ['roi'], openQuestions: '顧客接点への適用の時期' };
  const md = toMarkdown(data, state);
  let pos = -1;
  for (const h of SHEET_HEADINGS) {
    const i = md.indexOf(`\n## ${h}\n`);
    assert.ok(i > pos, `見出し「${h}」が順に出る`);
    pos = i;
  }
  assert.match(md, /## 7\. 統治の最低限\n\nS3 仕事に組み込む に合わせた最低限/, '統治の最低限は次のステップの段階');
  assert.match(md, /- ガイドライン: /);
  assert.match(md, /- 承認の位置: /);
  assert.match(md, /## 8\. 答えていない問い\n\n顧客接点への適用の時期\n/);
  assert.match(md, /## 3\. 早期警戒指標\n\n- 企業利用率の伸びが鈍る/);
  assert.match(md, /## 5\. 運営モデル\n\n- ステップ 1\(S3\): \*\*集中\(CoE\)\*\*/);
  assert.match(md, /## 6\. 必要なものと提供事業者の層\n\n### ステップ 1: S3 仕事に組み込む\n\n- 人材: /);
  assert.match(md, /次に上げるべき場所/);
  assert.match(md, /関係する軸: /);
  // 未記入なら案内文、未回答でも 8 見出しは出る
  const md2 = toMarkdown(data, createState());
  for (const h of SHEET_HEADINGS) assert.ok(md2.includes(`\n## ${h}\n`), h);
  assert.match(md2, /\(未記入\)/);
  // 決めない場合は 3 つの道筋の指標がすべて出る
  const md3 = toMarkdown(data, { ...state, path: 'undecided' });
  assert.match(md3, /道筋A：加速:\n- METR/);
  assert.match(md3, /道筋C：調整:\n- AI 関連の設備投資が減速する/);
  // governanceMinimum は計画が無ければ現在地の段階
  assert.equal(governanceMinimum(framework, null, framework.adoption.stages[1]).stage.id, 'S2');
  assert.equal(governanceMinimum(framework, null, null), null);
});

test('weakestSummary: 同点の設問は最大 3 件 + 「ほか N 問」。全設問が同点なら 1 行にまとめる', () => {
  const s = axis('adoption');
  // 6 問中 4 問が同点 → 3 件 + ほか 1 問
  const w = weakestSummary(s, { s1: 1, s2: 1, s3: 1, s4: 1, s5: 2, s6: 3 });
  assert.equal(w.level, 1);
  assert.equal(w.shown.length, 3);
  assert.equal(w.more, 1);
  assert.equal(w.allSame, false);
  assert.deepEqual(w.shown.map((x) => x.no), [1, 2, 3]);
  assert.match(w.text, /^導入フェーズ: 導入 1「.+」、導入 2「.+」、導入 3「.+」ほか 1 問\(いずれも S1\)$/);
  // 全設問が同点 → 設問を並べない
  const all = weakestSummary(s, { s1: 2, s2: 2, s3: 2, s4: 2, s5: 2, s6: 2 });
  assert.equal(all.allSame, true);
  assert.match(all.text, /^導入フェーズ: 全設問が同じ段階\(S2\)のため/);
  assert.doesNotMatch(all.text, /「/);
  // 同点 2 件なら 2 件そのまま、「ほか」は付かない
  const two = weakestSummary(axis('culture'), { c1: 3, c2: 1, c3: 4, c4: 1, c5: 2, c6: 5 });
  assert.equal(two.shown.length, 2);
  assert.equal(two.more, 0);
  assert.match(two.text, /^文化フェーズ: 文化 2「.+」、文化 4「.+」\(いずれも C1\)$/);
  // 未回答なら空
  assert.equal(weakestSummary(s, {}).text, '');
  // 件数は変えられる
  assert.equal(weakestSummary(s, { s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, s6: 2 }, { max: 2 }).more, 3);
});

test('concernReport は定義順に並べ、未知の id を捨てる', () => {
  const r = concernReport(concernsData.items, ['roi', 'unknown', 'where-to-start']);
  assert.deepEqual(r.map((c) => c.id), ['where-to-start', 'roi']);
});
