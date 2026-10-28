<!-- 現在地診断。3 軸の設問に答え、集計結果を図で示す -->
<script lang="ts">
  import { app } from '../store.svelte';
  import { framework, questions } from '../data';
  import { NOT_APPLICABLE, diagnose } from '../engine.mjs';
  import PositionChart from './PositionChart.svelte';
  import EvidenceLinks from './EvidenceLinks.svelte';

  const diagnosis = $derived(diagnose(framework, questions, app.answers));

  /** 段階の記号(S1、C1 など)。事業フェーズは記号を持たず、「該当しない」は段階ではないので省く */
  function stageTag(axisId: string, value: string | number): string {
    if (value === NOT_APPLICABLE) return '';
    if (axisId === 'adoption') return `S${value}`;
    if (axisId === 'culture') return `C${value}`;
    return '';
  }

  function select(axisId: string, qid: string, value: string | number) {
    if (axisId === 'business') app.answers.business[qid] = String(value);
    else if (axisId === 'adoption') app.answers.adoption[qid] = Number(value);
    else app.answers.culture[qid] = Number(value);
  }

  function isChecked(axisId: string, qid: string, value: string | number): boolean {
    if (axisId === 'business') return app.answers.business[qid] === value;
    if (axisId === 'adoption') return app.answers.adoption[qid] === value;
    return app.answers.culture[qid] === value;
  }

  const progress = $derived({
    answered: diagnosis.business.answered + diagnosis.adoption.answered + diagnosis.culture.answered,
    total: diagnosis.business.total + diagnosis.adoption.total + diagnosis.culture.total,
  });
</script>

<h2>現在地診断</h2>
<p>3 つの軸について、いまの状態にもっとも近い選択肢を選びます。各選択肢の先頭の記号は、対応する段階です。</p>
<p class="status" role="status">回答 {progress.answered} / {progress.total}</p>

{#each questions.axes as axis}
  <section aria-labelledby={`axis-${axis.id}`}>
    <h3 id={`axis-${axis.id}`}>{axis.label}</h3>
    <p>{axis.intro}</p>
    {#each axis.questions as q, qi}
      <fieldset>
        <legend>{qi + 1}. {q.text}</legend>
        <div class="options">
          {#each q.options as opt}
            <label class="option">
              <input type="radio" name={`${axis.id}-${q.id}`} value={String(opt.value)} checked={isChecked(axis.id, q.id, opt.value)} onchange={() => select(axis.id, q.id, opt.value)} />
              <span>
                {#if stageTag(axis.id, opt.value)}<span class="stage-tag" aria-hidden="true">{stageTag(axis.id, opt.value)}</span>{/if}{opt.label}
              </span>
            </label>
          {/each}
        </div>
      </fieldset>
    {/each}
  </section>
{/each}

<section aria-labelledby="position-heading" class="card">
  <h3 id="position-heading">現在地</h3>
  <PositionChart {diagnosis} />
  <p class="term">診断は自己申告に基づく目安です。導入と文化は回答の平均を四捨五入した段階、事業は回答の多数決で決めています。</p>
  <EvidenceLinks chapters={['32-three-positions', '30-genai-adoption-stages', '36-culture-formation', '23-maturity-models']} />
</section>

<div class="actions">
  <button type="button" class="btn" onclick={() => (app.step = 0)}>戻る</button>
  <button type="button" class="btn primary" disabled={!diagnosis.complete} onclick={() => (app.step = 2)}>未来の選択へ進む</button>
  {#if !diagnosis.complete}<span class="status">すべての設問に答えると進めます</span>{/if}
</div>
