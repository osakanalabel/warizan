// けっか画面・きろく画面の描画と、画面の切りかえ。

import { KIND_LABELS, KINDS } from '../core/steps.js';
import { LEVELS, LEVEL_LABELS } from '../core/problem.js';
import { summary as statsSummary } from '../core/stats.js';

const ADVICE = {
  tateru: 'しょうを たてるのが むずかしかったね。「いくつ はいるかな」と くくで さがしてみよう',
  kakeru: 'かけざんで つまずいたね。くくを もう いちど たしかめよう',
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
  const wrap = el('div', 'bars');
  const max = Math.max(1, ...KINDS.map((k) => errors[k] ?? 0));
  const total = KINDS.reduce((n, k) => n + (errors[k] ?? 0), 0);

  if (total === 0) {
    wrap.append(el('p', 'note', 'まちがいは 0 かい。すごい！'));
    return wrap;
  }
  for (const kind of KINDS) {
    const n = errors[kind] ?? 0;
    const row = el('div', 'bar');
    row.append(el('span', 'bar__name', KIND_LABELS[kind]));
    const track = el('span', 'bar__track');
    const fill = el('span', 'bar__fill');
    fill.style.width = `${Math.round((n / max) * 100)}%`;
    if (n === max) fill.classList.add('bar__fill--worst');
    track.append(fill);
    row.append(track);
    row.append(el('span', 'bar__count', `${n}かい`));
    wrap.append(row);
  }
  return wrap;
}

/** 10問おわったときの けっか。 */
export function renderRoundResult(container, round, stats) {
  container.textContent = '';
  container.append(el('h2', 'title', '10もん おわり！'));
  container.append(el('p', 'subtitle', `レベル${round.level}  ${LEVEL_LABELS[round.level]}`));

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

  const all = statsSummary(stats);
  const lv = all.levels.find((l) => l.level === round.level);
  container.append(el(
    'p',
    'note',
    `レベル${round.level} は これまで ${lv.problems}もん。せいかいりつ ${rateText(lv.cellRate)}`,
  ));
}

/** きろく画面。 */
export function renderRecord(container, stats) {
  container.textContent = '';
  const all = statsSummary(stats);

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

export { LEVELS };
