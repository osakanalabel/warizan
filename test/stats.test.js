import test from 'node:test';
import assert from 'node:assert/strict';

import {
  emptyStats, normalize, addProblem, addRound, summary, weakestKind, roundResult, rate,
  STATS_VERSION,
} from '../src/core/stats.js';
import { makeProblem } from '../src/core/problem.js';
import * as J from '../src/core/judge.js';

function play(problem, wrongAt = []) {
  let s = J.createSession(problem);
  let i = 0;
  while (!s.done) {
    const expect = J.currentStep(s).cells[s.inputIndex].expect;
    if (wrongAt.includes(i)) {
      const bad = expect === '9' ? '8' : '9';
      ({ session: s } = J.input(s, bad));
    }
    ({ session: s } = J.input(s, expect));
    i += 1;
  }
  return J.summarize(s);
}

test('はじめは すべて 0', () => {
  const st = emptyStats();
  assert.equal(st.version, STATS_VERSION);
  for (const l of ['1', '2', '3']) {
    assert.deepEqual(st.levels[l], { cells: 0, cellsOk: 0, problems: 0, problemsPerfect: 0, rounds: 0 });
    assert.deepEqual(st.errors[l], { tateru: 0, kakeru: 0, hiku: 0, orosu: 0 });
  }
  assert.equal(summary(st).played, false);
});

test('1問ぶんを足しこむ（もとのデータは変えない）', () => {
  const st0 = emptyStats();
  const sum = play(makeProblem(612, 6, 1));
  const st1 = addProblem(st0, sum, '2026-09-29');
  assert.equal(st0.levels['1'].problems, 0, 'もとを書きかえない');
  assert.equal(st1.levels['1'].problems, 1);
  assert.equal(st1.levels['1'].problemsPerfect, 1);
  assert.equal(st1.levels['1'].cells, sum.attempts);
  assert.equal(st1.levels['1'].cellsOk, sum.attemptsOk);
  assert.equal(st1.lastPlayedAt, '2026-09-29');
});

test('まちがえた問題は ノーミスに数えず、ステップ別に記録する', () => {
  const sum = play(makeProblem(612, 6, 1), [0, 2]); // たてる と ひく をまちがえる
  assert.equal(sum.perfect, false);
  assert.equal(sum.errors.tateru, 1);
  assert.equal(sum.errors.hiku, 1);

  const st = addProblem(emptyStats(), sum);
  assert.equal(st.levels['1'].problemsPerfect, 0);
  assert.equal(st.errors['1'].tateru, 1);
  assert.equal(st.errors['1'].hiku, 1);
  assert.equal(st.errors['1'].kakeru, 0);
});

test('addRound は 回数を数える', () => {
  let st = emptyStats();
  st = addRound(st, 2, '2026-09-29');
  st = addRound(st, 2);
  assert.equal(st.levels['2'].rounds, 2);
  assert.equal(st.levels['3'].rounds, 0);
});

test('正答率は マス単位と ノーミス率の2つ', () => {
  let st = emptyStats();
  st = addProblem(st, { level: 2, attempts: 10, attemptsOk: 8, perfect: false, errors: { hiku: 2 } });
  st = addProblem(st, { level: 2, attempts: 10, attemptsOk: 10, perfect: true, errors: {} });
  const lv = summary(st).levels.find((l) => l.level === 2);
  assert.equal(lv.cellRate, 90);
  assert.equal(lv.perfectRate, 50);
  assert.equal(lv.weakest, 'hiku');
  assert.equal(summary(st).played, true);
});

test('やっていないレベルの正答率は null（0% と区別する）', () => {
  const lv = summary(emptyStats()).levels.find((l) => l.level === 3);
  assert.equal(lv.cellRate, null);
  assert.equal(lv.perfectRate, null);
  assert.equal(lv.weakest, null);
  assert.equal(rate(0, 0), null);
  assert.equal(rate(0, 5), 0);
});

test('こわれたデータ・古いデータは 初期値にもどす', () => {
  assert.deepEqual(normalize(null), emptyStats());
  assert.deepEqual(normalize('こわれてる'), emptyStats());
  assert.deepEqual(normalize({ version: 999, levels: {} }), emptyStats());
  const patched = normalize({
    version: STATS_VERSION,
    levels: { 1: { cells: -5, cellsOk: 'x', problems: 2.7, problemsPerfect: 1, rounds: null } },
    errors: { 1: { tateru: 3, hiku: NaN, sonota: 9 } },
    lastPlayedAt: 12345,
  });
  assert.deepEqual(patched.levels['1'], { cells: 0, cellsOk: 0, problems: 2, problemsPerfect: 1, rounds: 0 });
  assert.deepEqual(patched.errors['1'], { tateru: 3, kakeru: 0, hiku: 0, orosu: 0 });
  assert.equal(patched.lastPlayedAt, null);
  assert.equal(Object.keys(patched.errors['1']).length, 4, '知らないキーは入れない');
});

test('weakestKind は いちばん多い まちがい、無ければ null', () => {
  assert.equal(weakestKind({ tateru: 1, kakeru: 5, hiku: 5, orosu: 0 }), 'kakeru');
  assert.equal(weakestKind({ tateru: 0, kakeru: 0, hiku: 0, orosu: 0 }), null);
  assert.equal(weakestKind(undefined), null);
});

test('roundResult は 10問ぶんをまとめる', () => {
  const sums = [
    { level: 3, attempts: 12, attemptsOk: 12, perfect: true, errors: {} },
    { level: 3, attempts: 14, attemptsOk: 12, perfect: false, errors: { tateru: 2 } },
  ];
  const r = roundResult(3, sums);
  assert.equal(r.problems, 2);
  assert.equal(r.perfect, 1);
  assert.equal(r.cells, 26);
  assert.equal(r.cellsOk, 24);
  assert.equal(r.cellRate, 92);
  assert.equal(r.perfectRate, 50);
  assert.equal(r.weakest, 'tateru');
  assert.deepEqual(r.errors, { tateru: 2, kakeru: 0, hiku: 0, orosu: 0 });
});

test('レベルをまたいだ まちがいの合計も出す', () => {
  let st = emptyStats();
  st = addProblem(st, { level: 1, attempts: 5, attemptsOk: 4, perfect: false, errors: { orosu: 1 } });
  st = addProblem(st, { level: 3, attempts: 5, attemptsOk: 3, perfect: false, errors: { orosu: 2 } });
  const s = summary(st);
  assert.equal(s.errors.orosu, 3);
  assert.equal(s.weakest, 'orosu');
});
