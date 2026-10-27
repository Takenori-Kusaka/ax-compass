// データファイルを 1 か所で読み、engine の型に合わせて公開する
import frameworkJson from '../data/framework.json';
import questionsJson from '../data/questions.json';
import concernsJson from '../data/concerns.json';
import evidenceJson from '../data/evidence.json';
import type { Concern, Evidence, Framework, QuestionSet } from './engine.mjs';

export const framework: Framework = frameworkJson as Framework;
export const questions: QuestionSet = questionsJson as QuestionSet;
export const concerns: Concern[] = concernsJson.items as Concern[];
export const evidence: Evidence[] = evidenceJson.items as Evidence[];
export const data = { framework, questions, concerns, evidence };

export const REPO_URL = 'https://github.com/Takenori-Kusaka/ax-compass';
export const BOOK_URL = 'https://zenn.dev/takenori_kusaka/books/ai-transformation-blueprint';
