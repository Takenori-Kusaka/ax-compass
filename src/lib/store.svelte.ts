// アプリの状態は 1 つのオブジェクト。全コンポーネントがここを読み書きする。
// localStorage への保存と URL ハッシュからの復元は App.svelte が担う(ここは DOM に触れない)。
import { createNotes, createState, type AppState } from './engine.mjs';

export const app: AppState = $state(createState());

/** 読み込んだ状態で置き換える(参照を保ったまま中身を差し替える) */
export function replaceState(next: AppState): void {
  app.version = next.version;
  app.step = next.step;
  app.answers = next.answers;
  app.path = next.path;
  app.concerns = next.concerns;
  app.openQuestions = next.openQuestions ?? '';
  app.notes = { ...createNotes(), ...(next.notes ?? {}) };
}

export function resetState(): void {
  replaceState(createState());
}
