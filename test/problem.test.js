import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVELS, makeRound, makeProblem, problemKey, trace,
  trialQuotient, isTooBig, needsFix, ROUND_SIZE,
} from '../src/core/problem.js';
import { mulberry32 } from '../src/core/rng.js';

const ROUNDS = 100; // 100回 × 10問 = 各レベル1000問

function roundsFor(level, seed = 20260929) {
  const rng = mulberry32(seed + level);
  const out = [];
  for (let i = 0; i < ROUNDS; i++) out.push(makeRound(level, rng));
  return out;
}

const allRounds = Object.fromEntries(LEVELS.map((l) => [l, roundsFor(l)]));
const allProblems = Object.fromEntries(LEVELS.map((l) => [l, allRounds[l].flat()]));

test('各レベル1000問を生成できる', () => {
  for (const level of LEVELS) {
    assert.equal(allProblems[level].length, ROUNDS * ROUND_SIZE);
    assert.equal(allProblems[level].length, 1000);
  }
});

test('受け入れ基準1: 商 × わる数 + あまり = わられる数', () => {
  for (const level of LEVELS) {
    for (const p of allProblems[level]) {
      assert.equal(
        p.quotient * p.divisor + p.remainder,
        p.dividend,
        `検算に合わない: ${p.dividend} ÷ ${p.divisor}`,
      );
      assert.ok(p.remainder >= 0 && p.remainder < p.divisor, `あまりの範囲: ${problemKey(p)}`);
    }
  }
});

test('わる数は 0 も 1 も使わない / レベルごとのけた数', () => {
  for (const level of LEVELS) {
    for (const p of allProblems[level]) {
      assert.ok(p.divisor >= 2, `わる数が小さすぎる: ${problemKey(p)}`);
      if (level === 3) {
        assert.ok(p.divisor >= 11 && p.divisor <= 99, `2けたでない: ${problemKey(p)}`);
      } else {
        assert.ok(p.divisor <= 9, `1けたでない: ${problemKey(p)}`);
      }
      const len = String(p.dividend).length;
      assert.ok(len === 2 || len === 3, `わられる数が2〜3けたでない: ${problemKey(p)}`);
    }
  }
});

test('商が 0 になる問題は出さない', () => {
  for (const level of LEVELS) {
    for (const p of allProblems[level]) {
      assert.ok(p.quotient >= 1, `商が0: ${problemKey(p)}`);
    }
  }
});

test('レベル1 は すべて わり切れる', () => {
  for (const p of allProblems[1]) {
    assert.equal(p.remainder, 0, `わり切れない: ${problemKey(p)}`);
  }
});

test('レベル2・3 は あまりのある問題が主で、1回に1問だけ あまり0 を混ぜる', () => {
  for (const level of [2, 3]) {
    for (const round of allRounds[level]) {
      const zero = round.filter((p) => p.remainder === 0);
      assert.equal(zero.length, 1, `レベル${level}: あまり0 が ${zero.length} 問`);
    }
  }
});

test('受け入れ基準3: 境界ケースが各レベルの毎回に混ざる', () => {
  for (const level of LEVELS) {
    for (const round of allRounds[level]) {
      const has = (tag) => round.some((p) => p.tags.includes(tag));
      assert.ok(has('zeroInQuotient'), `レベル${level}: 商の途中に0が立つ問題がない`);
      assert.ok(has('shortLeadDigit'), `レベル${level}: 先頭のけたが わる数 より小さい問題がない`);
      assert.ok(has('noRemainder'), `レベル${level}: あまり0 の問題がない`);
    }
  }
});

test('レベル3 は 仮の商が大きすぎる問題を毎回2問以上ふくむ', () => {
  for (const round of allRounds[3]) {
    const fix = round.filter((p) => p.tags.includes('needsFix'));
    assert.ok(fix.length >= 2, `needsFix が ${fix.length} 問しかない`);
  }
});

test('同じ回に同じ問題は出さない', () => {
  for (const level of LEVELS) {
    for (const round of allRounds[level]) {
      const keys = new Set(round.map(problemKey));
      assert.equal(keys.size, ROUND_SIZE);
    }
  }
});

test('タグは実際の筆算と合っている', () => {
  for (const level of LEVELS) {
    for (const p of allProblems[level]) {
      const t = trace(p.dividend, p.divisor);
      assert.equal(
        p.tags.includes('zeroInQuotient'),
        t.stages.some((s) => s.q === 0),
        `zeroInQuotient が合わない: ${problemKey(p)}`,
      );
      assert.equal(
        p.tags.includes('shortLeadDigit'),
        t.digits[0] < p.divisor,
        `shortLeadDigit が合わない: ${problemKey(p)}`,
      );
      assert.equal(p.tags.includes('noRemainder'), p.remainder === 0);
    }
  }
});

test('trace: 桁ごとの流れが筆算と一致する', () => {
  for (const level of LEVELS) {
    for (const p of allProblems[level]) {
      const t = trace(p.dividend, p.divisor);
      const q = t.quotientDigits.filter((d) => d !== null).join('');
      assert.equal(q, String(p.quotient), `商のけたが合わない: ${problemKey(p)}`);
      assert.equal(t.stages.length, q.length);
      for (const s of t.stages) {
        assert.equal(s.product, s.q * p.divisor);
        assert.equal(s.rest, s.partial - s.product);
        assert.ok(s.rest >= 0 && s.rest < p.divisor, `ひいた あまり: ${problemKey(p)}`);
        assert.ok(s.q >= 0 && s.q <= 9);
      }
      const last = t.stages[t.stages.length - 1];
      assert.equal(last.rest, p.remainder);
      assert.notEqual(t.stages[0].q, 0, '先頭の段の商は 0 にならない');
    }
  }
});

test('trialQuotient と isTooBig: 見積もりが実際より小さくなることはない', () => {
  for (let divisor = 11; divisor <= 99; divisor++) {
    for (let partial = divisor; partial < divisor * 10 && partial < 1000; partial++) {
      const stage = {
        partial,
        q: Math.floor(partial / divisor),
        product: Math.floor(partial / divisor) * divisor,
        rest: partial % divisor,
      };
      const t = trialQuotient(partial, divisor);
      assert.ok(t >= stage.q, `見積もりが小さい: ${partial} ÷ ${divisor}`);
      if (isTooBig(stage, divisor, t)) {
        assert.ok(t * divisor > partial, 'ひけないはずなのに ひける');
        assert.ok(String(t * divisor).length <= String(partial).length, '欄からあふれる');
      }
    }
  }
});

test('needsFix の問題は 見積もりだけでは ひけない段をもつ', () => {
  for (const p of allProblems[3]) {
    if (!p.tags.includes('needsFix')) continue;
    const t = trace(p.dividend, p.divisor);
    const bad = t.stages.filter((s) => isTooBig(s, p.divisor, trialQuotient(s.partial, p.divisor)));
    assert.ok(bad.length >= 1, `修正が必要な段がない: ${problemKey(p)}`);
    assert.ok(needsFix(t, p.divisor));
  }
});

test('同じ たね なら同じ10問になる', () => {
  const a = makeRound(3, mulberry32(7));
  const b = makeRound(3, mulberry32(7));
  assert.deepEqual(a.map(problemKey), b.map(problemKey));
});

test('makeProblem: 手で確かめた例', () => {
  const p = makeProblem(612, 6, 1);
  assert.deepEqual(
    { q: p.quotient, r: p.remainder, tags: p.tags.sort() },
    { q: 102, r: 0, tags: ['noRemainder', 'zeroInQuotient'] },
  );
  const q = makeProblem(124, 3, 2);
  assert.deepEqual({ q: q.quotient, r: q.remainder }, { q: 41, r: 1 });
  assert.ok(q.tags.includes('shortLeadDigit'));
});
