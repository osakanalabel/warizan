import test from 'node:test';
import assert from 'node:assert/strict';

import { makeProblem, makeRound, LEVELS } from '../src/core/problem.js';
import { buildDrill } from '../src/core/steps.js';
import * as J from '../src/core/judge.js';
import { mulberry32 } from '../src/core/rng.js';

/** いまのマスの正解 */
function expected(s) {
  return J.currentStep(s).cells[s.inputIndex].expect;
}

/** 正解を n 手だけ進める */
function advance(s, n) {
  for (let i = 0; i < n; i++) ({ session: s } = J.input(s, expected(s)));
  return s;
}

test('1回まちがえると、そのマスが赤くなって やり直しになる', () => {
  const s0 = J.createSession(makeProblem(342, 27, 3));
  const cell = J.activeCell(s0);
  const { session: s, result } = J.input(s0, 9);
  assert.equal(result.status, 'ng');
  assert.equal(result.cell, cell);
  assert.ok(s.wrongCells.includes(cell));
  assert.equal(s.filled[cell], undefined, 'まちがいは書きこまない');
  assert.equal(J.activeCell(s), cell, '同じマスに とどまる');
  assert.equal(s.errors.tateru, 1);
  assert.equal(s.attempts, 1);
  assert.equal(s.attemptsOk, 0);
  assert.ok(!J.isPerfect(s));
  assert.notEqual(s0.wrongCells.length, 1, 'もとの session は変えない');
});

test('まちがいの理由を みじかいことばで返す', () => {
  const base = J.createSession(makeProblem(96, 4, 2)); // 9 の中に 4 は 2つ
  const big = J.input(base, 4).result;
  assert.match(big.message, /4 × 4 は 16 で、9 より おおきく なるよ/);
  const small = J.input(base, 1).result;
  assert.match(small.message, /おおきく できる/);

  let s = advance(base, 1); // たてる 2
  const kakeru = J.input(s, 9).result;
  assert.equal(kakeru.kind, 'kakeru');
  assert.match(kakeru.message, /4 × 2 を もう いちど/);
});

test('2回続けてまちがえると 正解を見せて つぎへ すすむ', () => {
  let s = J.createSession(makeProblem(342, 27, 3));
  const cell = J.activeCell(s);
  ({ session: s } = J.input(s, 9));
  const { session: s2, result } = J.input(s, 8);
  assert.equal(result.status, 'ngShown');
  assert.ok(result.stepDone, 'ひと目ぶんのステップも 終わっている');
  assert.match(result.message, /こたえは 1 だよ/);
  assert.equal(s2.filled[cell], '1');
  assert.notEqual(J.activeCell(s2), cell, 'つぎのマスへ すすむ');
  assert.ok(s2.shownAnswer.includes(cell));
  assert.equal(s2.wrongStreak, 0, 'つぎのマスでは 数え直す');
  assert.equal(s2.errors.tateru, 2);
  assert.ok(!J.isPerfect(s2));
});

test('レベル3: 仮の商が大きすぎると、ひけないことで気づかせて やり直す', () => {
  // 342 ÷ 27 → 34 の中に 27 は 1つ。27 を 20 と見ると 2 と見つもってしまう
  let s = J.createSession(makeProblem(342, 27, 3));
  const qCell = J.activeCell(s);
  let r;

  ({ session: s, result: r } = J.input(s, 2));
  assert.equal(r.status, 'tooBig');
  assert.equal(s.filled[qCell], '2', 'いったん書かせる');
  assert.equal(s.mode, 'fixing');
  assert.match(J.hintOf(s), /27 × 2/);
  assert.equal(s.errors.tateru, 0, 'まだ まちがいとして数えない');

  // 27 × 2 = 54 を 1の くらいから 書く
  ({ session: s, result: r } = J.input(s, 4));
  assert.equal(r.status, 'ok');
  ({ session: s, result: r } = J.input(s, 5));
  assert.equal(r.status, 'cantSubtract');
  assert.match(r.message, /34 から 54 は ひけない/);
  assert.match(r.message, /1 ちいさく/);

  assert.equal(s.mode, 'normal');
  assert.equal(s.filled[qCell], undefined, '商を消してやり直させる');
  assert.equal(J.activeCell(s), qCell);
  assert.ok(s.wrongCells.includes(qCell));
  assert.equal(s.errors.tateru, 1, 'たてる の まちがいとして1回数える');
  assert.equal(Object.keys(s.filled).filter((c) => c.startsWith('p')).length, 0, '書いた積は消す');

  ({ session: s, result: r } = J.input(s, 1)); // 正しい商
  assert.equal(r.status, 'ok');
  assert.ok(r.stepDone);
  assert.equal(s.filled[qCell], '1');
});

test('やり直しでも また大きすぎたら 正解を見せる', () => {
  let s = J.createSession(makeProblem(342, 27, 3));
  let r;
  ({ session: s } = J.input(s, 2));
  ({ session: s } = J.input(s, 4));
  ({ session: s } = J.input(s, 5)); // cantSubtract → streak 1
  ({ session: s, result: r } = J.input(s, 3)); // また大きすぎる
  assert.equal(r.status, 'ngShown');
  assert.match(r.message, /こたえは 1 だよ/);
  assert.equal(s.mode, 'normal', '2回目は 修正の流れに入らない');
});

test('レベル1・2（1けたで わる）では 修正の流れに入らない', () => {
  for (const [n, d, lv] of [[96, 4, 2], [612, 6, 1]]) {
    const drill = buildDrill(makeProblem(n, d, lv));
    for (const step of drill.steps) {
      if (step.kind === 'tateru') assert.deepEqual(step.tooBig, []);
    }
    const s = J.createSession(makeProblem(n, d, lv));
    const r = J.input(s, 9).result;
    assert.equal(r.status, 'ng');
  }
});

test('商が 0 の段では とばす理由を note で返す', () => {
  let s = J.createSession(makeProblem(612, 6, 1));
  let r;
  s = advance(s, 3);                       // たてる1・かける6・ひく0
  ({ session: s, result: r } = J.input(s, 1)); // おろす 1
  assert.equal(r.kind, 'orosu');
  ({ session: s, result: r } = J.input(s, 0)); // たてる 0
  assert.match(r.note, /とばして/);
  assert.equal(J.currentStep(s).kind, 'orosu');
});

test('最後まで入れると problemDone になり、それ以上の入力は無視する', () => {
  let s = J.createSession(makeProblem(612, 6, 1));
  const total = s.drill.cellCount;
  s = advance(s, total - 1);
  const { session: last, result } = J.input(s, expected(s));
  assert.equal(result.status, 'ok');
  assert.ok(result.problemDone);
  assert.ok(result.stepDone);
  assert.equal(result.message, 'できた！');
  assert.ok(last.done);
  const after = J.input(last, 5);
  assert.equal(after.result.status, 'ignored');
  assert.equal(after.session, last);
  assert.equal(J.currentStep(last), null);
  assert.equal(J.activeCell(last), null);
});

test('ヒントは いまのマスの考え方を返す', () => {
  const rng = mulberry32(3);
  for (const level of LEVELS) {
    for (const p of makeRound(level, rng)) {
      let s = J.createSession(p);
      while (!s.done) {
        const hint = J.hintOf(s);
        assert.ok(hint.length > 0, `ヒントが空: ${p.dividend}/${p.divisor}`);
        assert.ok(!/[A-Za-z]/.test(hint), `ヒントに英字が混ざる: ${hint}`);
        ({ session: s } = J.input(s, expected(s)));
      }
    }
  }
});

test('光らせるマスは いまのステップのマスだけ', () => {
  let s = J.createSession(makeProblem(342, 27, 3));
  s = advance(s, 1); // かける（2マス）へ
  const step = J.currentStep(s);
  assert.equal(step.kind, 'kakeru');
  assert.deepEqual(J.stepCells(s), step.cells.map((c) => c.cell));
  assert.equal(J.stepCells(s).length, 2);
  assert.equal(J.activeCell(s), step.cells[0].cell);
  assert.equal(J.activeCell(s), 'p0#1', '1の くらいの マスから 入れる');
});

test('ひきざんは 1の くらいの マスが さきに 光る', () => {
  // 342 ÷ 27 の 2段目 72 ー 54 = 18。くりさがりがあるので 8 → 1 の順
  let s = J.createSession(makeProblem(342, 27, 3));
  s = advance(s, 8); // たてる1・かける27・ひく7・おろす2・たてる2・かける54 まで
  assert.equal(J.currentStep(s).kind, 'hiku');
  assert.equal(J.activeCell(s), 'r1#2', '1の くらいが さき');

  ({ session: s } = J.input(s, 8));
  assert.equal(J.activeCell(s), 'r1#1', 'つぎは 10の くらい');
  assert.equal(s.filled['r1#2'], '8');

  const wrong = J.input(s, 9).result;
  assert.match(wrong.message, /くりさがりに/);

  ({ session: s } = J.input(s, 1));
  assert.ok(s.done);
  assert.equal(J.readRemainder(s), '18', 'けた順に よむと 18');
});

test('progressOf は 入れたマスの数を返す', () => {
  let s = J.createSession(makeProblem(612, 6, 1));
  assert.deepEqual(J.progressOf(s), { done: 0, total: s.drill.cellCount });
  s = advance(s, 4);
  assert.equal(J.progressOf(s).done, 4);
});

test('summarize は 1問ぶんの成績を返す', () => {
  let s = J.createSession(makeProblem(96, 4, 2));
  ({ session: s } = J.input(s, 9)); // まちがい
  while (!s.done) ({ session: s } = J.input(s, expected(s)));
  const sum = J.summarize(s);
  assert.equal(sum.level, 2);
  assert.equal(sum.perfect, false);
  assert.equal(sum.errors.tateru, 1);
  assert.equal(sum.attempts, sum.attemptsOk + 1);
});
