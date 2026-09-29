// 問題生成と、ひっ算の桁ごとの流れ（trace）を求める純粋モジュール。
// DOM・localStorage・Math.random には触らない。乱数は rng 引数で受け取る。

export const LEVELS = [1, 2, 3];

/** 各レベルの説明（ひらがな） */
export const LEVEL_LABELS = {
  1: 'わりきれる わりざん',
  2: 'あまりの ある わりざん',
  3: '2けたで わる わりざん',
};

export function digitsOf(n) {
  return String(n).split('').map(Number);
}

/**
 * ひっ算を桁ごとにたどる。
 * stages は「商が1桁立つ」処理の並び。先頭の割れない桁は stages に入らない。
 * quotientDigits は わられる数 の桁と同じ長さで、商が立たない桁は null。
 */
export function trace(dividend, divisor) {
  const digits = digitsOf(dividend);
  const stages = [];
  const quotientDigits = [];
  let rest = 0;
  let started = false;

  for (let col = 0; col < digits.length; col++) {
    const partial = rest * 10 + digits[col];
    const q = Math.floor(partial / divisor);
    if (!started && q === 0) {
      quotientDigits.push(null);
      rest = partial;
      continue;
    }
    started = true;
    quotientDigits.push(q);
    stages.push({ col, partial, q, product: q * divisor, rest: partial - q * divisor });
    rest = partial - q * divisor;
  }

  return {
    digits,
    quotientDigits,
    stages,
    quotient: Math.floor(dividend / divisor),
    remainder: dividend % divisor,
  };
}

/** わる数の十の位だけを見た「仮の商」。2けたでわるときの見積もりのしかた。 */
export function trialQuotient(partial, divisor) {
  const tens = Math.floor(divisor / 10);
  if (tens < 1) return Math.min(9, Math.floor(partial / divisor));
  return Math.min(9, Math.floor(partial / (tens * 10)));
}

/**
 * 仮の商 trial を書いても筆算の欄からあふれず、かつ ひけない（大きすぎる）か。
 * あふれる場合は「気づかせる」流れに乗せられないので対象外にする。
 */
export function isTooBig(stage, divisor, trial) {
  if (trial <= stage.q || trial > 9) return false;
  const product = trial * divisor;
  if (product <= stage.partial) return false;
  return String(product).length <= String(stage.partial).length;
}

/** その段で、書いても良い「大きすぎる仮の商」の一覧。 */
export function tooBigCandidates(stage, divisor) {
  const out = [];
  for (let d = stage.q + 1; d <= 9; d++) {
    if (isTooBig(stage, divisor, d)) out.push(d);
  }
  return out;
}

/** 見積もりが大きすぎて修正が必要な段をふくむか。 */
export function needsFix(stagesOrTrace, divisor) {
  const stages = Array.isArray(stagesOrTrace) ? stagesOrTrace : stagesOrTrace.stages;
  return stages.some((s) => isTooBig(s, divisor, trialQuotient(s.partial, divisor)));
}

/** わられる数・わる数から Problem を組み立てる。境界ケースのタグもここで付ける。 */
export function makeProblem(dividend, divisor, level) {
  const t = trace(dividend, divisor);
  const tags = [];
  if (t.stages.some((s) => s.q === 0)) tags.push('zeroInQuotient');
  if (t.quotientDigits[0] === null) tags.push('shortLeadDigit');
  if (t.remainder === 0) tags.push('noRemainder');
  if (divisor >= 10 && needsFix(t, divisor)) tags.push('needsFix');
  return {
    level,
    dividend,
    divisor,
    quotient: t.quotient,
    remainder: t.remainder,
    tags,
  };
}

export function problemKey(p) {
  return `${p.dividend}/${p.divisor}`;
}

// ---- 1回10問の組み立て --------------------------------------------------

// 各スロットの条件。need は必ず持つタグ、deny は持ってはいけないタグ。
const ROUND_SLOTS = {
  1: [
    { need: ['zeroInQuotient'] },
    { need: ['shortLeadDigit'] },
    {}, {}, {}, {}, {}, {}, {}, {},
  ],
  2: [
    { need: ['zeroInQuotient'], deny: ['noRemainder'] },
    { need: ['shortLeadDigit'], deny: ['noRemainder'] },
    { need: ['noRemainder'] },
    { deny: ['noRemainder'] },
    { deny: ['noRemainder'] },
    { deny: ['noRemainder'] },
    { deny: ['noRemainder'] },
    { deny: ['noRemainder'] },
    { deny: ['noRemainder'] },
    { deny: ['noRemainder'] },
  ],
  3: [
    { need: ['needsFix'], deny: ['noRemainder'] },
    { need: ['needsFix'], deny: ['noRemainder'] },
    { need: ['zeroInQuotient'], deny: ['noRemainder'] },
    { need: ['shortLeadDigit'], deny: ['noRemainder'], minDigits: 3 },
    { need: ['noRemainder'] },
    { deny: ['noRemainder'] },
    { deny: ['noRemainder'] },
    { deny: ['noRemainder'] },
    { deny: ['noRemainder'] },
    { deny: ['noRemainder'] },
  ],
};

export const ROUND_SIZE = 10;

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffled(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function divisorRange(level) {
  // わる数に 0 と 1 は使わない
  return level === 3 ? [11, 99] : [2, 9];
}

function matches(p, slot) {
  const need = slot.need ?? [];
  const deny = slot.deny ?? [];
  if (!need.every((t) => p.tags.includes(t))) return false;
  if (deny.some((t) => p.tags.includes(t))) return false;
  if (slot.minDigits && String(p.dividend).length < slot.minDigits) return false;
  return true;
}

/** わられる数 のとりうる範囲。レベル3は3けたにそろえる。 */
function dividendRange(level) {
  return level === 3 ? [100, 999] : [10, 999];
}

/** ランダムに1問つくる（条件は見ない）。商とあまりから組み立てる。つくれなければ null。 */
function candidate(level, rng) {
  const [dlo, dhi] = divisorRange(level);
  const [nlo, nhi] = dividendRange(level);
  const divisor = randInt(rng, dlo, dhi);

  // あまり: レベル1は 0、ほかは 0〜わる数-1
  const rest = level === 1 ? 0 : randInt(rng, 0, divisor - 1);

  const qMin = Math.max(1, Math.ceil((nlo - rest) / divisor));
  const qMax = Math.floor((nhi - rest) / divisor);
  if (qMin > qMax) return null;

  let q = randInt(rng, qMin, qMax);
  // レベル3は商が2けたになる問題を多めにする（1けただと1段で終わってしまう）
  if (level === 3 && q < 10 && qMax >= 10 && rng() < 0.75) {
    q = randInt(rng, 10, qMax);
  }
  // レベル1・2は3けたの わられる数 を多めにする
  if (level !== 3 && rng() < 0.7) {
    const q3 = Math.max(qMin, Math.ceil((100 - rest) / divisor));
    if (q3 <= qMax) q = randInt(rng, q3, qMax);
  }

  const dividend = q * divisor + rest;
  if (dividend < nlo || dividend > nhi) return null;
  if (dividend <= divisor) return null; // 商が 0 や、わる数と同じ問題は出さない
  return makeProblem(dividend, divisor, level);
}

/** 条件に合う問題をしらみつぶしに探す（ランダムで見つからなかったときの保険）。 */
function scanProblem(level, rng, accept) {
  const [dlo, dhi] = divisorRange(level);
  const [nlo, nhi] = dividendRange(level);
  const span = nhi - nlo + 1;
  const divisors = [];
  for (let d = dlo; d <= dhi; d++) divisors.push(d);
  const offset = Math.floor(rng() * span);

  for (const divisor of shuffled(divisors, rng)) {
    for (let k = 0; k < span; k++) {
      const dividend = nlo + ((offset + k) % span);
      if (dividend <= divisor) continue;
      if (level === 1 && dividend % divisor !== 0) continue;
      const p = makeProblem(dividend, divisor, level);
      if (accept(p)) return p;
    }
  }
  return null;
}

/** 条件 accept を満たす1問を返す。 */
export function findProblem(level, rng, accept) {
  for (let i = 0; i < 400; i++) {
    const p = candidate(level, rng);
    if (p && accept(p)) return p;
  }
  return scanProblem(level, rng, accept);
}

/** 1回分（10問）をつくる。境界ケースを必ず混ぜ、同じ問題は重ねない。 */
export function makeRound(level, rng = Math.random) {
  const slots = ROUND_SLOTS[level];
  if (!slots) throw new Error(`unknown level: ${level}`);

  const used = new Set();
  const round = [];
  for (const slot of slots) {
    const p = findProblem(level, rng, (q) => matches(q, slot) && !used.has(problemKey(q)));
    if (!p) throw new Error(`level ${level}: no problem matches slot ${JSON.stringify(slot)}`);
    used.add(problemKey(p));
    round.push(p);
  }
  return shuffled(round, rng);
}
