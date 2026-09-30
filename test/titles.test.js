import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_XP_PER_PROBLEM, PERFECT_PROBLEM_BONUS, PERFECT_ROUND_BONUS, LEVEL_MULTIPLIER,
  MAX_TITLE_LEVEL, THRESHOLD,
  titleForLevel, xpForProblem, xpForRound, maxPossibleRoundXp,
  levelForXp, progressForXp, titleChange, titleList,
} from '../src/core/titles.js';

function summary({ level = 3, perfect = true } = {}) {
  return { level, attempts: 12, attemptsOk: perfect ? 12 : 11, perfect, errors: {} };
}

// --- しきい値の安全性（このアプリの設計の要） -----------------------------

test('しきい値は「1ラウンドの理論上の最大XP」以上になっている', () => {
  const max = maxPossibleRoundXp();
  assert.ok(
    THRESHOLD >= max,
    `THRESHOLD(${THRESHOLD}) が maxPossibleRoundXp(${max}) を下回っている。` +
      'このままだと1ラウンドで称号が2つ以上 上がってしまう可能性がある',
  );
});

test('実際に「10問ぜんぶ レベル③・ノーミス」を計算しても、maxPossibleRoundXp を超えない', () => {
  const summaries = Array.from({ length: 10 }, () => summary({ level: 3, perfect: true }));
  const xp = xpForRound(summaries);
  assert.equal(xp, maxPossibleRoundXp());
  assert.ok(xp <= THRESHOLD, '最大XPの実測値が しきい値を超えている');
});

test('受け入れ基準（安全性）: どんな開始位置からでも、1ラウンドで称号は最大1つしか上がらない', () => {
  const maxRoundXp = maxPossibleRoundXp();
  // 「いまのレベルに入った直後(0)」から「次まであと1(threshold-1)」まで、
  // すべての開始位置で検算する。
  for (let startProgress = 0; startProgress < THRESHOLD; startProgress++) {
    const beforeXp = 5 * THRESHOLD + startProgress; // レベル6の途中を模す
    const beforeLevel = levelForXp(beforeXp);
    const afterLevel = levelForXp(beforeXp + maxRoundXp);
    assert.ok(
      afterLevel - beforeLevel <= 1,
      `startProgress=${startProgress} で ${afterLevel - beforeLevel} レベル上がった`,
    );
  }
});

test('レベル①②③ をまぜた、ありうる限りの1ラウンド（10問の組み合わせ）でも2レベル以上は上がらない', () => {
  // 1ラウンドは同じレベルの10問だが、念のため levelForXp 自体の単調性も検算する
  for (let xp = 0; xp <= THRESHOLD * MAX_TITLE_LEVEL + 1000; xp += 17) {
    const a = levelForXp(xp);
    const b = levelForXp(xp + maxPossibleRoundXp());
    assert.ok(b - a <= 1, `xp=${xp} から最大XPぶん足すと ${b - a} レベル上がった`);
  }
});

// --- XP計算 ---------------------------------------------------------------

test('xpForProblem: レベルごとの倍率が正しく反映される', () => {
  assert.equal(xpForProblem(summary({ level: 1, perfect: false })), 10);
  assert.equal(xpForProblem(summary({ level: 1, perfect: true })), 13);
  assert.equal(xpForProblem(summary({ level: 2, perfect: false })), 13);
  assert.equal(xpForProblem(summary({ level: 2, perfect: true })), 16);
  assert.equal(xpForProblem(summary({ level: 3, perfect: false })), 18);
  assert.equal(xpForProblem(summary({ level: 3, perfect: true })), 21);
});

test('xpForProblem: 未知のレベルはエラーにする', () => {
  assert.throws(() => xpForProblem(summary({ level: 9 })));
});

test('xpForRound: ラウンドボーナスは10問ぜんぶノーミスのときだけ', () => {
  const allPerfect = Array.from({ length: 10 }, () => summary({ level: 1, perfect: true }));
  const oneWrong = [
    ...Array.from({ length: 9 }, () => summary({ level: 1, perfect: true })),
    summary({ level: 1, perfect: false }),
  ];
  assert.equal(xpForRound(allPerfect), 10 * 13 + PERFECT_ROUND_BONUS);
  assert.equal(xpForRound(oneWrong), 9 * 13 + 1 * 10);
  assert.equal(xpForRound([]), 0);
});

test('maxPossibleRoundXp は 定数から素直に計算できる', () => {
  const maxMult = Math.max(...Object.values(LEVEL_MULTIPLIER));
  const expected = (Math.round(BASE_XP_PER_PROBLEM * maxMult) + PERFECT_PROBLEM_BONUS) * 10 + PERFECT_ROUND_BONUS;
  assert.equal(maxPossibleRoundXp(), expected);
});

// --- レベル・進捗 -----------------------------------------------------------

test('levelForXp: 0XPはレベル1から始まる', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(THRESHOLD - 1), 1);
  assert.equal(levelForXp(THRESHOLD), 2);
  assert.equal(levelForXp(THRESHOLD * 2 - 1), 2);
});

test('levelForXp: MAX_TITLE_LEVEL で頭打ちになる（負けない/超えない）', () => {
  assert.equal(levelForXp(THRESHOLD * MAX_TITLE_LEVEL * 100), MAX_TITLE_LEVEL);
  assert.equal(levelForXp(-999), 1);
});

test('progressForXp: 進捗が しきい値内におさまる', () => {
  const p = progressForXp(THRESHOLD * 2 + 50);
  assert.equal(p.level, 3);
  assert.equal(p.progress, 50);
  assert.equal(p.threshold, THRESHOLD);
  assert.equal(p.percent, Math.round((50 / THRESHOLD) * 100));
  assert.equal(p.isMax, false);
  assert.equal(p.title, titleForLevel(3));
});

test('progressForXp: 最大レベルでは進捗が頭打ち表示になる', () => {
  const p = progressForXp(THRESHOLD * MAX_TITLE_LEVEL + 5000);
  assert.equal(p.level, MAX_TITLE_LEVEL);
  assert.equal(p.isMax, true);
  assert.equal(p.progress, THRESHOLD);
  assert.equal(p.percent, 100);
});

test('titleChange: レベルが上がったかどうかを正しく判定する', () => {
  const same = titleChange(10, 20);
  assert.equal(same.leveledUp, false);

  const up = titleChange(THRESHOLD - 5, THRESHOLD + 5);
  assert.equal(up.leveledUp, true);
  assert.equal(up.before.level, 1);
  assert.equal(up.after.level, 2);
});

// --- 称号の中身 -------------------------------------------------------------

test('称号は ちょうど30個、すべてユニーク', () => {
  const all = Array.from({ length: MAX_TITLE_LEVEL }, (_, i) => titleForLevel(i + 1));
  assert.equal(all.length, MAX_TITLE_LEVEL);
  assert.equal(new Set(all).size, MAX_TITLE_LEVEL, '重複した称号がある');
  for (const t of all) {
    assert.ok(typeof t === 'string' && t.length > 0);
  }
});

test('称号の文字に 漢字を つかっていない', () => {
  const kanji = /[㐀-䶿一-鿿]/;
  for (let level = 1; level <= MAX_TITLE_LEVEL; level++) {
    const t = titleForLevel(level);
    assert.ok(!kanji.test(t), `Lv.${level} の称号に漢字がある: ${t}`);
  }
});

test('titleForLevel: 範囲外はエラーにする', () => {
  assert.throws(() => titleForLevel(0));
  assert.throws(() => titleForLevel(MAX_TITLE_LEVEL + 1));
});

test('titleList: 到達していない称号は中身を見せない（完全ロック）', () => {
  const list = titleList(3);
  assert.equal(list.length, MAX_TITLE_LEVEL);
  assert.equal(list[0].reached, true);
  assert.equal(list[0].title, titleForLevel(1));
  assert.equal(list[2].reached, true);
  assert.equal(list[2].title, titleForLevel(3));
  assert.equal(list[3].reached, false);
  assert.equal(list[3].title, null, '未到達の称号は中身を見せない');
  assert.equal(list[MAX_TITLE_LEVEL - 1].reached, false);
});
