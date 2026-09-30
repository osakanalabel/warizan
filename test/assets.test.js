// ファイルの取りこぼしを見つけるテスト。
// とくに sw.js の PRECACHE は、ファイルを足したときに更新をわすれやすい。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const html = read('index.html');
const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

function listFiles(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = posix.join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) listFiles(rel, out);
    else out.push(rel);
  }
  return out;
}

const precache = [...sw.matchAll(/'(\.\/[^']*)'/g)]
  .map((m) => m[1])
  .filter((p) => p !== './');

test('sw.js の PRECACHE に書いたファイルは すべて ある', () => {
  for (const p of precache) {
    assert.ok(existsSync(join(ROOT, p)), `ないファイル: ${p}`);
  }
});

test('src の JavaScript は すべて PRECACHE に入っている', () => {
  const missing = listFiles('src')
    .filter((f) => f.endsWith('.js'))
    .filter((f) => !precache.includes(`./${f}`));
  assert.deepEqual(missing, [], 'PRECACHE に足しわすれている');
});

test('CACHE_NAME に ばんごうが ついている', () => {
  const m = sw.match(/const CACHE_NAME = '([^']+)'/);
  assert.ok(m, 'CACHE_NAME がない');
  assert.match(m[1], /-v\d+$/, 'ばんごうの形が ちがう（例: warizan-v1）');
});

test('index.html が よぶファイルは すべて ある', () => {
  const refs = [...html.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 5);
  for (const ref of refs) {
    assert.ok(existsSync(join(ROOT, ref)), `ないファイル: ${ref}`);
  }
});

test('manifest の アイコンは すべて ある', () => {
  assert.ok(manifest.icons.length >= 2);
  for (const icon of manifest.icons) {
    assert.ok(existsSync(join(ROOT, icon.src)), `ないアイコン: ${icon.src}`);
    const png = readFileSync(join(ROOT, icon.src));
    assert.equal(png.subarray(1, 4).toString(), 'PNG', `PNG でない: ${icon.src}`);
    const side = Number(icon.sizes.split('x')[0]);
    assert.equal(png.readUInt32BE(16), side, `大きさが ちがう: ${icon.src}`);
  }
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'), 'maskable が ない');
});

test('app.js がさがす id は index.html にある', () => {
  const app = read('src/app.js');
  const ids = [...app.matchAll(/pick\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(ids.length >= 15);
  for (const id of ids) {
    assert.ok(html.includes(`id="${id}"`), `index.html に id="${id}" がない`);
  }
});

test('ホームの レベルボタンと きろくの バッジが そろっている', () => {
  for (const level of [1, 2, 3]) {
    assert.ok(html.includes(`data-level="${level}"`), `レベル${level} のボタンがない`);
    assert.ok(html.includes(`data-badge="${level}"`), `レベル${level} のバッジがない`);
  }
});

test('端末のキーボードを出す要素を つかっていない', () => {
  assert.doesNotMatch(html, /<input/i, 'input 要素は つかわない');
  assert.doesNotMatch(html, /<textarea/i, 'textarea は つかわない');
  assert.doesNotMatch(html, /contenteditable/i, 'contenteditable は つかわない');
});

test('外部のライブラリを よみこんでいない', () => {
  const external = [...html.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(external, [], '外部の読みこみは なしにする');
});

/** コメントを取りのぞく（説明文の中の語を ひろわないように）。 */
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('core は DOM や localStorage に さわらない', () => {
  for (const file of listFiles('src/core')) {
    const code = stripComments(read(file));
    for (const banned of ['document', 'window', 'localStorage', 'Math.random()', 'Date.now(']) {
      assert.ok(!code.includes(banned), `${file} が ${banned} をつかっている`);
    }
  }
});

// 画面に出る文字は すべて ひらがな（数字は算用数字）。
// ただし「九九」だけは 漢字のまま（算数の授業で見る表記に あわせる）。ほかに例外はない。
// コメントは開発者向けなので、ここでは見ない。
test('画面に出る文字に 漢字を つかっていない（九九 だけ 例外）', () => {
  const kanji = /[㐀-䶿一-鿿]/;
  const files = [...listFiles('src'), 'index.html', 'manifest.webmanifest'];
  for (const file of files) {
    const text = stripComments(read(file)).replace(/<!--[\s\S]*?-->/g, '');
    text.split(/\r?\n/).forEach((line, i) => {
      const rest = line.replace(/九九/g, ''); // 例外は「九九」ひとつだけ
      assert.ok(!kanji.test(rest), `${file}:${i + 1} に 漢字が ある: ${line.trim()}`);
    });
  }
});
