// 成績の集計。localStorage には触らない（保存は src/storage.js の役目）。

import { KINDS } from './steps.js';
import { LEVELS } from './problem.js';
import { xpForRound, progressForXp } from './titles.js';

export const STATS_VERSION = 1;

function emptyLevel() {
  return { cells: 0, cellsOk: 0, problems: 0, problemsPerfect: 0, rounds: 0 };
}

function emptyErrors() {
  return Object.fromEntries(KINDS.map((k) => [k, 0]));
}

export function emptyStats() {
  return {
    version: STATS_VERSION,
    levels: Object.fromEntries(LEVELS.map((l) => [String(l), emptyLevel()])),
    errors: Object.fromEntries(LEVELS.map((l) => [String(l), emptyErrors()])),
    xp: 0,
    lastPlayedAt: null,
  };
}

function toCount(v) {
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

/** 読みこんだデータを安全な形にそろえる。こわれていても落ちない。 */
export function normalize(raw) {
  const base = emptyStats();
  if (!raw || typeof raw !== 'object' || raw.version !== STATS_VERSION) return base;

  for (const l of LEVELS) {
    const key = String(l);
    const src = raw.levels?.[key];
    if (src && typeof src === 'object') {
      for (const f of Object.keys(base.levels[key])) base.levels[key][f] = toCount(src[f]);
    }
    const err = raw.errors?.[key];
    if (err && typeof err === 'object') {
      for (const k of KINDS) base.errors[key][k] = toCount(err[k]);
    }
  }
  base.xp = toCount(raw.xp);
  base.lastPlayedAt = typeof raw.lastPlayedAt === 'string' ? raw.lastPlayedAt : null;
  return base;
}

/**
 * 1問ぶんの結果（judge.summarize の戻り）を足しこむ。
 * 元のデータは変えず、新しいオブジェクトを返す。
 */
export function addProblem(stats, summary, today = null) {
  const next = normalize(stats);
  const key = String(summary.level);
  if (!next.levels[key]) return next;

  const lv = next.levels[key];
  lv.cells += toCount(summary.attempts);
  lv.cellsOk += toCount(summary.attemptsOk);
  lv.problems += 1;
  if (summary.perfect) lv.problemsPerfect += 1;

  for (const k of KINDS) next.errors[key][k] += toCount(summary.errors?.[k]);
  if (today) next.lastPlayedAt = today;
  return next;
}

export function addRound(stats, level, xpEarned, today = null) {
  const next = normalize(stats);
  const key = String(level);
  if (next.levels[key]) next.levels[key].rounds += 1;
  next.xp += toCount(xpEarned);
  if (today) next.lastPlayedAt = today;
  return next;
}

export function rate(ok, all) {
  if (!all) return null;
  return Math.round((ok / all) * 100);
}

/** 結果画面・きろく画面のための読みやすい形にまとめる。 */
export function summary(stats) {
  const st = normalize(stats);
  const levels = LEVELS.map((l) => {
    const key = String(l);
    const lv = st.levels[key];
    return {
      level: l,
      ...lv,
      cellRate: rate(lv.cellsOk, lv.cells),
      perfectRate: rate(lv.problemsPerfect, lv.problems),
      errors: { ...st.errors[key] },
      weakest: weakestKind(st.errors[key]),
    };
  });
  const totalErrors = emptyErrors();
  for (const l of LEVELS) {
    for (const k of KINDS) totalErrors[k] += st.errors[String(l)][k];
  }
  return {
    levels,
    errors: totalErrors,
    weakest: weakestKind(totalErrors),
    played: levels.some((l) => l.problems > 0),
    lastPlayedAt: st.lastPlayedAt,
    title: progressForXp(st.xp),
  };
}

/** いちばん まちがえた ステップ。まちがいが無ければ null。 */
export function weakestKind(errors) {
  let best = null;
  for (const k of KINDS) {
    const n = errors?.[k] ?? 0;
    if (n > 0 && (best === null || n > errors[best])) best = k;
  }
  return best;
}

/** 1回（10問）ぶんの結果をまとめる。 */
export function roundResult(level, summaries) {
  const errors = emptyErrors();
  let cells = 0;
  let cellsOk = 0;
  let perfect = 0;
  for (const s of summaries) {
    cells += s.attempts;
    cellsOk += s.attemptsOk;
    if (s.perfect) perfect += 1;
    for (const k of KINDS) errors[k] += s.errors?.[k] ?? 0;
  }
  return {
    level,
    problems: summaries.length,
    perfect,
    cells,
    cellsOk,
    cellRate: rate(cellsOk, cells),
    perfectRate: rate(perfect, summaries.length),
    errors,
    weakest: weakestKind(errors),
    xp: xpForRound(summaries),
  };
}
