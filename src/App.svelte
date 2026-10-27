<!-- 画面遷移: はじめに → 現在地診断 → 未来の選択 → 悩み → 結果。
     状態は store の app ひとつ。localStorage へ自動保存し、URL のハッシュ(#s=)から復元する -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { app, replaceState, resetState } from './lib/store.svelte';
  import { framework, questions, BOOK_URL, REPO_URL } from './lib/data';
  import { decodeState, diagnose, parseState } from './lib/engine.mjs';
  import Stepper from './lib/components/Stepper.svelte';
  import Intro from './lib/components/Intro.svelte';
  import Diagnose from './lib/components/Diagnose.svelte';
  import Future from './lib/components/Future.svelte';
  import Concerns from './lib/components/Concerns.svelte';
  import Result from './lib/components/Result.svelte';

  const STORAGE_KEY = 'ax-compass:state:v1';
  let ready = $state(false);

  const diagnosis = $derived(diagnose(framework, questions, app.answers));
  const hasSaved = $derived(diagnosis.business.answered + diagnosis.adoption.answered + diagnosis.culture.answered > 0);

  /** 終えていない工程へは飛べない(結果が空のまま出るのを防ぐ) */
  function canJump(index: number): boolean {
    if (index <= 1) return true;
    if (index === 2) return diagnosis.complete;
    if (index === 3) return diagnosis.complete && !!app.path;
    return diagnosis.complete && !!app.path;
  }

  onMount(() => {
    // 共有 URL が優先。なければ前回の続き
    const m = location.hash.match(/^#s=([A-Za-z0-9_-]+)$/);
    const fromUrl = m ? decodeState(m[1], questions) : null;
    if (fromUrl) {
      replaceState(fromUrl);
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? parseState(JSON.parse(raw), questions) : null;
        if (parsed) replaceState(parsed);
      } catch {
        // 保存領域が使えない環境では復元を諦める
      }
    }
    ready = true;
  });

  $effect(() => {
    if (!ready) return;
    const json = JSON.stringify(app);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      // プライベートモードなどで書けないときは保存しない
    }
  });

  $effect(() => {
    // 画面が変わったら先頭へ。工程表示が見えるようにする
    void app.step;
    if (ready) window.scrollTo({ top: 0 });
  });

  function reset() {
    resetState();
    history.replaceState(null, '', location.pathname);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 無視
    }
  }
</script>

<header class="site-header">
  <div class="container">
    <h1>AX コンパス</h1>
    <p class="tagline">AI トランスフォーメーションの現在地診断 ── 3 つの軸で現在地を定め、道筋を選び、次のステップを 1 枚にまとめる</p>
    <Stepper {canJump} />
  </div>
</header>

<main class="container">
  {#if app.step === 0}
    <Intro {hasSaved} onReset={reset} />
  {:else if app.step === 1}
    <Diagnose />
  {:else if app.step === 2}
    <Future />
  {:else if app.step === 3}
    <Concerns />
  {:else}
    <Result />
  {/if}
</main>

<footer class="site-footer">
  <div class="container">
    <p>このアプリと本は生成AIを使って作成し、著者が内容を確認して公開しています。</p>
    <p>
      本: <a href={BOOK_URL} target="_blank" rel="noopener">{framework.book.title}</a>(Zenn)。
      リポジトリ: <a href={REPO_URL} target="_blank" rel="noopener">github.com/Takenori-Kusaka/ax-compass</a>。
    </p>
    <p>入力は端末のブラウザにだけ保存され、外部へ送信しません。アクセス解析は使っていません。</p>
  </div>
</footer>
