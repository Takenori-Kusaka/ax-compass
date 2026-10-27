// 個人ブランド基盤(kusaka-brand)の CSS とトークンを src/styles/brand/ へ複製する。正本は kusaka-brand。
//
//   node scripts/brand-sync.mjs <kusaka-brand のパス>   # 複製して manifest を書く
//   node scripts/brand-sync.mjs --check                  # 複製が manifest と一致するか(npm run check に含める)
//
// フォントと描画器は複製しない。図の描画は publishing-hub で行い、3 点(svg/png/json)だけを置く(BDR-0005)。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.join(ROOT, 'src/styles/brand');
const FILES = { 'dist/css/brand.css': 'brand.css', 'dist/tokens.flat.json': 'tokens.flat.json', 'LICENSE.md': 'LICENSE.md' };
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

function hashes() {
  const out = {};
  for (const f of Object.values(FILES)) out[f] = sha256(fs.readFileSync(path.join(DEST, f)));
  return out;
}

if (process.argv.includes('--check')) {
  const m = JSON.parse(fs.readFileSync(path.join(DEST, 'manifest.json'), 'utf8'));
  const now = hashes();
  const bad = Object.keys(m.files).filter((f) => m.files[f] !== now[f]);
  if (bad.length) { console.error(`brand: 複製が manifest と一致しません: ${bad.join(', ')}。複製を手で編集せず、正本を直して同期し直してください`); process.exit(1); }
  console.log(`brand: 複製は manifest と一致(@kusaka/brand@${m.version})`);
} else {
  const src = path.resolve(process.argv[2] || '');
  if (!fs.existsSync(path.join(src, 'dist/css/brand.css'))) { console.error('使い方: node scripts/brand-sync.mjs <kusaka-brand のパス> | --check'); process.exit(2); }
  fs.mkdirSync(DEST, { recursive: true });
  for (const [from, to] of Object.entries(FILES)) fs.copyFileSync(path.join(src, from), path.join(DEST, to));
  let commit = null;
  try { commit = execFileSync('git', ['-C', src, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* 未コミット */ }
  const version = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8')).version;
  fs.writeFileSync(path.join(DEST, 'manifest.json'), `${JSON.stringify({ '//': '複製の台帳。手で編集しない。正本は https://github.com/Takenori-Kusaka/kusaka-brand', version, sourceCommit: commit, syncedAt: new Date().toISOString(), files: hashes() }, null, 2)}\n`);
  console.log(`brand: @kusaka/brand@${version}${commit ? ` (${commit.slice(0, 7)})` : ''} を複製しました`);
}
