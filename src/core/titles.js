// XP・レベル・称号（コレクション）。DOM にも localStorage にも触らない純粋モジュール。
//
// しくみ:
//   1問クリアごとに XP をもらう（レベル①②③で倍率がちがう）。
//   XP がたまるとレベルが上がり、レベルごとに称号が1つずつ もらえる。
//   称号は ①②③ 共通の ひとつの れつ（LEVEL_TITLES）で、レベルによって分かれてはいない。
//
// しきい値の決めかた（だいじ）:
//   THRESHOLD は「1ラウンド（10問）で理論上 とりうる最大XP」以上にしてある。
//   そうすることで、1ラウンドで称号が2つ以上 いっぺんに上がることが
//   構造的にありえなくなる（あふれの繰り越し・切り捨てのような特別あつかいが要らない）。
//   XP の式を変えるときは、この前提が くずれていないか test/titles.test.js で必ず確かめること。

export const BASE_XP_PER_PROBLEM = 10;
export const PERFECT_PROBLEM_BONUS = 3; // その問題を ノーミスで解けたら
export const PERFECT_ROUND_BONUS = 20;  // 10問ぜんぶ ノーミスで解けたら

// レベル①②③ の XP倍率。むずかしいレベルほど 称号が早く近づく。
export const LEVEL_MULTIPLIER = { 1: 1.0, 2: 1.3, 3: 1.8 };

export const MAX_TITLE_LEVEL = 30;

// 1レベルぶんに必要な XP。1ラウンドの最大XPより大きい値にしてある（下の maxPossibleRoundXp を参照）。
export const THRESHOLD = 230;

// 称号（①②③ 共通のひとつの れつ）。ひらがな・カタカナのみ。
// ロックしていない称号だけ画面に出す（きろく画面ではロック中は「???」であらわす）。
//
// 文字列は base64 にしてある。理由はネタバレ防止だけで、セキュリティのためではない
// （ソースを開いてもすぐには読めない、という程度のもの）。デコードは b64d() で行う。
const LEVEL_TITLES_B64 = [
  '44KP44KK44GW44KT44GuIOOBn+OBvuOBlA==',
  '44KP44KK44Go44CB44KE44KL44GN44GMIOOBguOCi+OBsuOBqA==',
  '44KP44KK44GW44KT44Gn44KT44GK44GG44CB44GV44KT44GY44KH44GG77yB',
  '44GC44G+44KK44GuIOOBoeOBi+OCieOBqyDjgoHjgZbjgoHjgZfjgoLjga4=',
  '44KP44KK44GW44KT44Km44Kj44K244O844OJ44CB44GX44GC44KP44Gb44GuIOOBr+OBmOOBvuOCiuOBoA==',
  '44KP44KK44GW44KT44GuIOOBk+OBjeOCheOBhiDjgYTjgaHjga7jgYvjgZ8=',
  '44KP44KK44GW44KT44Gr44KT44GY44KD44CB44GX44KF44GO44KH44GG44Gh44KF44GG',
  '44KP44KK44Ku44Oj44OQ44Oz',
  '44K544O844OR44O844KP44KK44GW44KTIOODluODqeOCtuODvOOCug==',
  '44KP44KK44GW44KTIOOCqOOCsOOCvOOCpOODieOAgeODrOODmeODq+OCouODg+ODl++8gQ==',
  '44Gm44KT44Gb44GE44GX44Gf44KJIOOCj+OCiuOBluOCk+OBoOOBo+OBnyDjgZHjgpM=',
  '44KP44KK44GW44KT44Gk44GL44GE44GuIOOBp+OBlw==',
  '44Gc44KT44GX44KF44GG44Gh44KF44GG77yB44KP44KK44GW44KT44Gu44GT44GN44KF44GG',
  '44KM44KT44Ge44GP44Gb44GE44GL44GE44GnIOODluODvOOCueODiCDjga/jgaTjganjgYY=',
  '44GZ44GG44GY44GL44GE44GuIOOCruODq+ODieODnuOCueOCv+ODvA==',
  '44GL44KB44KT44Op44Kk44OA44O8IOOCj+OCiuOBluOCk+OAgeOBneOBhuOBoeOCg+OBj++8gQ==',
  '44GV44GC44CB44KP44KK44GW44KT44GuIOOBk+OBn+OBiOOCkiDjgYvjgZ7jgYjjgo0=',
  '44GC44KT44GT44GP44KB44KT44GuIOOCj+OCiuOBluOCk+OBpOOBi+OBhA==',
  '44KP44KK44GW44KT44Gb44KT44Gf44GEIOOCtOOCuOODpeOCpuOCuOODo+ODvA==',
  '44GZ44GG44GY44GL44GE44KSIOOBmeOBj+OBhuOCguOBrg==',
  '44OW44Os44K5IOOCquODliDjgrYg44KP44KK44Or44OJ',
  '44KP44KK44GW44KT44GuIOOBleOBhOOBl+OCheOBhuOBiuOBj+OBjg==',
  '44GZ44GG44GY44Gf44Gh44GuIOOBiuOBhuOBmOOCgw==',
  '44Op44K544Oc44K5IOOBjeOCheOBhuOBjeOCh+OBj+OCj+OCiuOBluOCkw==',
  '44KP44KK44GW44KTIOODqeOCpOODieOCpuOCqeODg+ODgeOCkiDjgYLjgaTjgoHjgZfjgoLjga4=',
  '44Gn44KT44Gb44Gk44KSIOOBpOOBj+OCi+OCguOBrg==',
  '44KP44KK44GW44KT44GuIOOBi+OBv+OBleOBvu+8iOOBi+OCi+OBhO+8iQ==',
  '44GG44Gh44KF44GG44GV44GE44GN44KH44GG44GuIOOCj+OCiuOBluOCk+OBlw==',
  '44KC44GGIOOBquOBq+OCgiDjgZPjgo/jgY/jgarjgYQ=',
  '44KP44KK44GW44KT44KSIOOBk+OBiOOBnyDjgZ3jgpPjgZbjgYQ=',
];

function b64d(s) {
  return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
}

/** 称号を読む（レベルは1〜30）。 */
export function titleForLevel(level) {
  const b64 = LEVEL_TITLES_B64[level - 1];
  if (b64 === undefined) throw new Error(`unknown title level: ${level}`);
  return b64d(b64);
}

/** 1問ぶんの XP。judge.summarize() の戻り値をそのまま渡す。 */
export function xpForProblem(summary) {
  const mult = LEVEL_MULTIPLIER[summary.level];
  if (mult === undefined) throw new Error(`unknown level: ${summary.level}`);
  const base = Math.round(BASE_XP_PER_PROBLEM * mult);
  return base + (summary.perfect ? PERFECT_PROBLEM_BONUS : 0);
}

/** 1ラウンド（10問）ぶんの XP。summaries は judge.summarize() の結果のはいれつ。 */
export function xpForRound(summaries) {
  const cells = summaries.reduce((n, s) => n + xpForProblem(s), 0);
  const bonus = summaries.length > 0 && summaries.every((s) => s.perfect) ? PERFECT_ROUND_BONUS : 0;
  return cells + bonus;
}

/**
 * 1問ぶんの XP がとりうる最大値（レベル③・ノーミス）。
 * xpForRound の理論上の最大値の計算に使う。
 */
function maxPerProblemXp() {
  const maxMult = Math.max(...Object.values(LEVEL_MULTIPLIER));
  return Math.round(BASE_XP_PER_PROBLEM * maxMult) + PERFECT_PROBLEM_BONUS;
}

/**
 * 1ラウンドで理論上 とりうる最大XP（10問ぜんぶ レベル③ノーミス＋ラウンドボーナス）。
 * THRESHOLD を決めるときに使った値。XP の式を変えたら、この値と THRESHOLD の
 * 大小関係を test/titles.test.js で必ず検算すること。
 */
export function maxPossibleRoundXp(roundSize = 10) {
  return maxPerProblemXp() * roundSize + PERFECT_ROUND_BONUS;
}

/** 累積XPから、いまのレベル（1〜MAX_TITLE_LEVEL）を求める。 */
export function levelForXp(xp) {
  const level = Math.floor(Math.max(0, xp) / THRESHOLD) + 1;
  return Math.min(MAX_TITLE_LEVEL, level);
}

/** そのレベルに入ってから たまった XP（0以上 THRESHOLD未満。最大レベルでは頭打ち）。 */
export function progressForXp(xp) {
  const level = levelForXp(xp);
  const isMax = level >= MAX_TITLE_LEVEL;
  const progress = isMax ? THRESHOLD : Math.max(0, xp) - (level - 1) * THRESHOLD;
  return {
    level,
    title: titleForLevel(level),
    progress,
    threshold: THRESHOLD,
    percent: Math.round((progress / THRESHOLD) * 100),
    isMax,
  };
}

/** ラウンド前後のXPから、称号が上がったかどうかを読みやすい形にまとめる。 */
export function titleChange(beforeXp, afterXp) {
  const before = progressForXp(beforeXp);
  const after = progressForXp(afterXp);
  return { leveledUp: after.level > before.level, before, after };
}

/** きろく画面の称号いちらん用。ロックされていない称号だけ中身を見せる。 */
export function titleList(currentLevel) {
  const out = [];
  for (let level = 1; level <= MAX_TITLE_LEVEL; level++) {
    out.push({
      level,
      reached: level <= currentLevel,
      title: level <= currentLevel ? titleForLevel(level) : null,
    });
  }
  return out;
}
