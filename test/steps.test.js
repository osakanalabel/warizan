import test from 'node:test';
import assert from 'node:assert/strict';

import { LEVELS, makeRound, makeProblem, problemKey, trace } from '../src/core/problem.js';
import { buildDrill, buildFixStep, cellIdAt, KINDS } from '../src/core/steps.js';
import * as J from '../src/core/judge.js';
import { mulberry32 } from '../src/core/rng.js';

const ROUNDS = 100;

function problemsFor(level, seed = 19260929) {
  const rng = mulberry32(seed + level);
  const out = [];
  for (let i = 0; i < ROUNDS; i++) out.push(...makeRound(level, rng));
  return out;
}

const allProblems = Object.fromEntries(LEVELS.map((l) => [l, problemsFor(l)]));

/** 正解だけを入れて最後までたどる。 */
function solve(problem) {
  let s = J.createSession(problem);
  let guard = 0;
  const kinds = [];
  while (!s.done) {
    assert.ok(guard++ < 200, `終わらない: ${problemKey(problem)}`);
    const step = J.currentStep(s);
    const slot = step.cells[s.inputIndex];
    assert.equal(J.activeCell(s), slot.cell);
    if (s.inputIndex === 0) kinds.push(step.kind);
    ({ session: s } = J.input(s, slot.expect));
  }
  return { session: s, kinds };
}

test('受け入れ基準2: 全問、正解入力でたどると 商とあまりが一致する', () => {
  for (const level of LEVELS) {
    assert.equal(allProblems[level].length, 1000);
    for (const p of allProblems[level]) {
      const { session } = solve(p);
      assert.equal(
        J.readQuotient(session),
        String(p.quotient),
        `商が合わない: ${problemKey(p)}`,
      );
      assert.equal(
        Number(J.readRemainder(session)),
        p.remainder,
        `あまりが合わない: ${problemKey(p)}`,
      );
      assert.ok(session.done);
      assert.ok(J.isPerfect(session));
      assert.equal(session.attempts, session.drill.cellCount);
    }
  }
});

test('ステップの種類は たてる/かける/ひく/おろす の4つだけ', () => {
  for (const level of LEVELS) {
    for (const p of allProblems[level]) {
      for (const step of buildDrill(p).steps) {
        assert.ok(KINDS.includes(step.kind), `知らない種類: ${step.kind}`);
        assert.ok(step.cells.length >= 1);
        assert.ok(typeof step.hint === 'string' && step.hint.length > 0, 'ヒントが空');
        assert.ok(typeof step.ng === 'string' && step.ng.length > 0);
        for (const c of step.cells) assert.match(c.expect, /^[0-9]$/);
      }
    }
  }
});

test('ステップの順番は 各段で たてる→かける→ひく→おろす', () => {
  for (const level of LEVELS) {
    for (const p of allProblems[level]) {
      const steps = buildDrill(p).steps;
      const t = trace(p.dividend, p.divisor);
      const want = [];
      t.stages.forEach((stage, i) => {
        want.push('tateru');
        if (stage.q > 0) want.push('kakeru', 'hiku');
        if (t.stages[i + 1]) want.push('orosu');
      });
      assert.deepEqual(steps.map((s) => s.kind), want, `順番がちがう: ${problemKey(p)}`);
    }
  }
});

test('2けた以上は かける も ひく も 1の くらいから 入れさせる', () => {
  // 342 ÷ 27 の 2段目: 27 × 2 = 54、72 ー 54 = 18。どちらも 右の けた から
  const drill = buildDrill(makeProblem(342, 27, 3));
  const columnsOf = (step) => step.cells.map((c) => Number(c.cell.split('#')[1]));

  const kakeru = drill.steps.filter((s) => s.kind === 'kakeru');
  assert.deepEqual(kakeru[0].cells.map((c) => c.expect), ['7', '2'], '27 は 7 → 2');
  assert.deepEqual(columnsOf(kakeru[0]), [1, 0]);
  assert.match(kakeru[0].hint, /1の くらいから/);
  assert.match(kakeru[0].ng, /くりあがり/);

  const twoDigits = drill.steps.find((s) => s.kind === 'hiku' && s.cells.length === 2);
  assert.deepEqual(twoDigits.cells.map((c) => c.expect), ['8', '1'], '18 は 8 → 1');
  assert.deepEqual(columnsOf(twoDigits), [2, 1]);
  assert.match(twoDigits.ng, /くりさがり/);

  // 1けたなら 「1の くらいから」 とは 言わない
  const oneDigit = drill.steps.find((s) => s.kind === 'hiku' && s.cells.length === 1);
  assert.equal(oneDigit.cells[0].expect, '7');
  assert.doesNotMatch(oneDigit.hint, /1の くらいから/);
});

test('すべてのステップが 1の くらい から 上の くらい へ すすむ', () => {
  for (const level of LEVELS) {
    for (const p of allProblems[level]) {
      for (const step of buildDrill(p).steps) {
        const cols = step.cells.map((c) => Number(c.cell.split('#')[1]));
        const rightToLeft = cols.slice().sort((a, b) => b - a);
        assert.deepEqual(cols, rightToLeft, `${step.kind} の じゅんばんが ちがう: ${problemKey(p)}`);
      }
    }
  }
});

test('仮の商の積（レベル3の やり直し）も 1の くらいから', () => {
  const drill = buildDrill(makeProblem(342, 27, 3));
  const stepIndex = drill.steps.findIndex((s) => s.kind === 'tateru' && s.tooBig.includes(2));
  assert.ok(stepIndex >= 0);
  const fix = buildFixStep(drill, stepIndex, 2); // 27 × 2 = 54
  assert.deepEqual(fix.cells.map((c) => c.expect), ['4', '5']);
  assert.deepEqual(fix.cells.map((c) => Number(c.cell.split('#')[1])), [1, 0]);
  assert.match(fix.hint, /1の くらいから/);
});

test('商が 0 の段は かける・ひく をとばし、その理由を出す', () => {
  const drill = buildDrill(makeProblem(612, 6, 1));
  const zero = drill.steps.find((s) => s.kind === 'tateru' && s.cells[0].expect === '0');
  assert.ok(zero, '0 をたてる段がない');
  assert.match(zero.after, /とばして/);
  const sameStage = drill.steps.filter((s) => s.stage === zero.stage);
  assert.deepEqual(sameStage.map((s) => s.kind), ['tateru', 'orosu']);
});

test('1つのマスに2つのちがう正解が割りあてられない', () => {
  for (const level of LEVELS) {
    for (const p of allProblems[level]) {
      const drill = buildDrill(p);
      const seen = new Map();
      for (const step of drill.steps) {
        for (const c of step.cells) {
          assert.ok(!seen.has(c.cell), `同じマスを2回入力させている: ${c.cell} (${problemKey(p)})`);
          seen.set(c.cell, c.expect);
          assert.equal(drill.values[c.cell], c.expect);
        }
      }
      for (const g of drill.given) assert.ok(!seen.has(g), '最初から見えるマスを入力させている');
    }
  }
});

test('マスの位置は 行と けた の中におさまる', () => {
  for (const level of LEVELS) {
    for (const p of allProblems[level]) {
      const drill = buildDrill(p);
      const rowIds = new Set(drill.rows.map((r) => r.id));
      for (const row of drill.rows) {
        for (const col of Object.keys(row.cells)) {
          const c = Number(col);
          assert.ok(c >= 0 && c < drill.cols, `けたが範囲外: ${row.id}#${col} (${problemKey(p)})`);
          assert.equal(row.cells[col], cellIdAt(row.id, c));
        }
        if (row.rule) {
          assert.ok(row.rule.from >= 0 && row.rule.to < drill.cols);
          assert.ok(row.rule.from <= row.rule.to);
        }
      }
      for (const step of drill.steps) {
        for (const c of step.cells) {
          assert.ok(rowIds.has(c.cell.split('#')[0]), `ない行のマス: ${c.cell}`);
        }
      }
    }
  }
});

test('あまりのマスは いちばん下に開いている行にある', () => {
  for (const level of LEVELS) {
    for (const p of allProblems[level]) {
      const drill = buildDrill(p);
      assert.ok(drill.remainderCells.length >= 1);
      assert.ok(drill.quotientCells.length === String(p.quotient).length);
      const rowId = drill.remainderCells[0].split('#')[0];
      assert.ok(drill.remainderCells.every((c) => c.split('#')[0] === rowId));
    }
  }
});

test('buildFixStep: 大きすぎる仮の商の積も 欄におさまる', () => {
  for (const p of allProblems[3]) {
    const drill = buildDrill(p);
    drill.steps.forEach((step, i) => {
      if (step.kind !== 'tateru') return;
      for (const trial of step.tooBig) {
        const fix = buildFixStep(drill, i, trial);
        assert.equal(fix.kind, 'kakeru');
        assert.ok(fix.fix);
        const byColumn = fix.cells
          .slice()
          .sort((a, b) => Number(a.cell.split('#')[1]) - Number(b.cell.split('#')[1]));
        assert.equal(
          byColumn.map((c) => c.expect).join(''),
          String(trial * p.divisor),
          `積がちがう: ${problemKey(p)} trial=${trial}`,
        );
        for (const c of fix.cells) {
          const col = Number(c.cell.split('#')[1]);
          assert.ok(col >= 0 && col < drill.cols, `欄からあふれる: ${c.cell} (${problemKey(p)})`);
        }
        assert.ok(trial * p.divisor > step.info.partial, 'ひけてしまう');
      }
    });
  }
});
