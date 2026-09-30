// けっか画面・きろく画面の描画と、画面の切りかえ。

import { KIND_LABELS, KINDS } from '../core/steps.js';
import { LEVELS, LEVEL_LABELS } from '../core/problem.js';
import { summary as statsSummary } from '../core/stats.js';
import { titleList, MAX_TITLE_LEVEL } from '../core/titles.js';

const ADVICE = {
  tateru: 'しょうを たてるのが むずかしかったね。「いくつ はいるかな」と 九九で さがしてみよう',
  kakeru: 'かけざんで つまずいたね。九九を もう いちど たしかめよう',
  hiku: 'ひきざんで つまずいたね。くりさがりに きを つけよう',
  orosu: 'おろすのを まちがえたね。つぎの くらいの かずを 1つだけ おろすよ',
};

export function showScreen(name) {
  document.body.dataset.screen = name;
  window.scrollTo(0, 0);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function rateText(value) {
  return value === null ? '—' : `${value}%`;
}

/** ステップ別の まちがい を ぼうグラフで出す。 */
function errorBars(errors) {
  const wrap = el('div', 'stat-bars');
  const max = Math.max(1, ...KINDS.map((k) => errors[k] ?? 0));
  const total = KINDS.reduce((n, k) => n + (errors[k] ?? 0), 0);

  if (total === 0) {
    wrap.append(el('p', 'note', 'まちがいは 0 かい。すごい！'));
    return wrap;
  }
  for (const kind of KINDS) {
    const n = errors[kind] ?? 0;
    const row = el('div', 'stat-bar');
    row.append(el('span', 'stat-bar__name', KIND_LABELS[kind]));
    const track = el('span', 'stat-bar__track');
    const fill = el('span', 'stat-bar__fill');
    fill.style.width = `${Math.round((n / max) * 100)}%`;
    if (n === max) fill.classList.add('stat-bar__fill--worst');
    track.append(fill);
    row.append(track);
    row.append(el('span', 'stat-bar__count', `${n}かい`));
    wrap.append(row);
  }
  return wrap;
}

/** 称号の進捗バー（現在の称号名＋つぎまでのバー）。 */
function titleProgressBlock(progress) {
  const wrap = el('div', 'title-progress');
  wrap.append(el('p', 'title-progress__name', `Lv.${progress.level}  ${progress.title}`));
  const track = el('div', 'title-progress__track');
  const fill = el('div', 'title-progress__fill');
  fill.style.width = `${progress.isMax ? 100 : progress.percent}%`;
  track.append(fill);
  wrap.append(track);
  wrap.append(el(
    'p',
    'note',
    progress.isMax ? 'ぜんぶの しょうごうを あつめたよ！' : `つぎの しょうごうまで あと ${progress.threshold - progress.progress} XP`,
  ));
  return wrap;
}

/** 10問おわったときの けっか。change は titles.titleChange() の戻り値。 */
export function renderRoundResult(container, round, stats, change) {
  container.textContent = '';

  if (change?.leveledUp) {
    const banner = el('div', 'levelup-banner');
    banner.append(el('p', 'levelup-banner__label', 'しょうごう アップ！'));
    banner.append(el('p', 'levelup-banner__title', `Lv.${change.after.level}  ${change.after.title}`));
    container.append(banner);
  }

  container.append(el('h2', 'title', '10もん おわり！'));
  container.append(el('p', 'subtitle', `レベル${round.level}  ${LEVEL_LABELS[round.level]}`));
  container.append(el('p', 'xp-earned', `+${round.xp} XP`));

  const scores = el('div', 'scores');
  const a = el('div', 'score');
  a.append(el('span', 'score__value', rateText(round.cellRate)));
  a.append(el('span', 'score__label', 'マスの せいかい'));
  const b = el('div', 'score');
  b.append(el('span', 'score__value', `${round.perfect}/${round.problems}`));
  b.append(el('span', 'score__label', 'ノーミスで とけた もんだい'));
  scores.append(a, b);
  container.append(scores);

  container.append(el('h3', 'section', 'まちがえた ところ'));
  container.append(errorBars(round.errors));
  if (round.weakest) container.append(el('p', 'advice', ADVICE[round.weakest]));

  if (change) container.append(titleProgressBlock(change.after));

  const all = statsSummary(stats);
  const lv = all.levels.find((l) => l.level === round.level);
  container.append(el(
    'p',
    'note',
    `レベル${round.level} は これまで ${lv.problems}もん。せいかいりつ ${rateText(lv.cellRate)}`,
  ));
}

/** 称号いちらんのカード。到達していない称号は ??? のまま。 */
function titleListCard(currentProgress) {
  const card = el('div', 'card');
  card.append(el('h3', 'card__title', 'しょうごう いちらん'));
  card.append(titleProgressBlock(currentProgress));

  const list = el('div', 'title-list');
  for (const row of titleList(currentProgress.level)) {
    const item = el('div', `title-row${row.reached ? ' title-row--reached' : ''}`);
    item.append(el('span', 'title-row__lv', `Lv.${row.level}`));
    item.append(el('span', 'title-row__name', row.reached ? row.title : '？？？'));
    if (row.level === currentProgress.level) item.append(el('span', 'title-row__mark', 'いま'));
    else if (row.reached) item.append(el('span', 'title-row__mark', '✓'));
    list.append(item);
  }
  card.append(list);
  card.append(el('p', 'note', `${currentProgress.level} / ${MAX_TITLE_LEVEL} こ あつめた`));
  return card;
}

/** きろく画面。 */
export function renderRecord(container, stats) {
  container.textContent = '';
  const all = statsSummary(stats);
  container.append(titleListCard(all.title));

  if (!all.played) {
    container.append(el('p', 'note', 'まだ きろくが ないよ。れんしゅうを してみよう'));
    return;
  }

  for (const lv of all.levels) {
    const card = el('div', 'card');
    card.append(el('h3', 'card__title', `レベル${lv.level}  ${LEVEL_LABELS[lv.level]}`));
    if (lv.problems === 0) {
      card.append(el('p', 'note', 'まだ やっていないよ'));
      container.append(card);
      continue;
    }
    const line = el('div', 'card__stats');
    line.append(el('span', '', `せいかいりつ ${rateText(lv.cellRate)}`));
    line.append(el('span', '', `ノーミス ${rateText(lv.perfectRate)}`));
    line.append(el('span', '', `${lv.problems}もん / ${lv.rounds}かい`));
    card.append(line);
    card.append(errorBars(lv.errors));
    if (lv.weakest) {
      card.append(el('p', 'advice', `いちばん まちがえたのは 「${KIND_LABELS[lv.weakest]}」`));
    }
    container.append(card);
  }

  const total = el('div', 'card');
  total.append(el('h3', 'card__title', 'ぜんぶ あわせて'));
  total.append(errorBars(all.errors));
  if (all.weakest) total.append(el('p', 'advice', ADVICE[all.weakest]));
  if (all.lastPlayedAt) total.append(el('p', 'note', `さいごに れんしゅうした ひ: ${all.lastPlayedAt}`));
  container.append(total);
}

/** ホーム画面のレベルボタンに、これまでの せいかいりつ をそえる。 */
export function renderHomeBadges(container, stats) {
  const all = statsSummary(stats);
  for (const lv of all.levels) {
    const badge = container.querySelector(`[data-badge="${lv.level}"]`);
    if (!badge) continue;
    badge.textContent = lv.problems === 0 ? 'はじめて' : `せいかい ${rateText(lv.cellRate)}`;
  }
}

/** ホーム画面に常時出す、いまの称号バッジ。 */
export function renderHomeTitle(container, stats) {
  if (!container) return; // 古い index.html を つかんだ ときの ほけん
  container.textContent = '';
  const { title } = statsSummary(stats);
  const badge = el('div', 'home-title');
  badge.append(el('span', 'home-title__lv', `Lv.${title.level}`));
  badge.append(el('span', 'home-title__name', title.title));
  const track = el('div', 'home-title__track');
  const fill = el('div', 'home-title__fill');
  fill.style.width = `${title.isMax ? 100 : title.percent}%`;
  track.append(fill);
  badge.append(track);
  container.append(badge);
}

export { LEVELS };
