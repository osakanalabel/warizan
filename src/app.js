// 画面と core をつなぐ司令塔。計算のきまりは core 側にあり、ここでは持たない。

import { makeRound, LEVELS, LEVEL_LABELS, ROUND_SIZE } from './core/problem.js';
import * as J from './core/judge.js';
import { roundResult, addProblem, addRound } from './core/stats.js';
import { titleChange } from './core/titles.js';
import { loadStats, saveStats, clearStats, storageWorks } from './storage.js';
import { buildGrid, updateGrid, fitGrid, revealActive, shakeCell } from './ui/grid.js';
import { buildKeypad, setKeypadEnabled } from './ui/keypad.js';
import {
  showScreen, renderRoundResult, renderRecord, renderHomeBadges, renderHomeTitle,
} from './ui/screens.js';

const dom = {};
const state = {
  level: null,
  round: [],
  index: 0,
  session: null,
  summaries: [],
  stats: null,
};

function pick(id) {
  return document.getElementById(id);
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function setMessage(text, tone = 'info') {
  dom.message.textContent = text;
  dom.message.dataset.tone = tone;
}

function setProgress() {
  dom.progress.textContent = `${state.index + 1} / ${ROUND_SIZE}`;
  dom.dots.textContent = '';
  state.round.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'dot';
    if (i < state.index) dot.classList.add(state.summaries[i]?.perfect ? 'dot--ok' : 'dot--done');
    if (i === state.index) dot.classList.add('dot--now');
    dom.dots.append(dot);
  });
}

// mode: 'input' = キーパッド、'next' = つぎへボタン
function setPadMode(mode) {
  dom.padArea.dataset.mode = mode;
  setKeypadEnabled(dom.keypad, mode === 'input');
}

// ---- れんしゅう ---------------------------------------------------------

function startRound(level) {
  state.level = level;
  state.round = makeRound(level);
  state.index = 0;
  state.summaries = [];
  dom.levelName.textContent = `レベル${level} ${LEVEL_LABELS[level]}`;
  showScreen('drill');
  loadProblem();
}

function loadProblem() {
  const problem = state.round[state.index];
  state.session = J.createSession(problem);
  dom.expr.textContent = `${problem.dividend} ÷ ${problem.divisor}`;
  setProgress();
  buildGrid(dom.grid, state.session.drill);
  layout();
  updateGrid(dom.grid, state.session);
  setPadMode('input');
  setMessage('ひかっている マスに、じゅんばんに かずを いれよう', 'info');
}

function layout() {
  if (!state.session) return;
  fitGrid(dom.stage, dom.grid, state.session.drill);
  revealActive(dom.stage, dom.grid, state.session);
}

function onDigit(digit) {
  if (!state.session || state.session.done) return;
  const { session, result } = J.input(state.session, digit);
  state.session = session;
  updateGrid(dom.grid, session);
  revealActive(dom.stage, dom.grid, session);

  switch (result.status) {
    case 'ng':
      shakeCell(dom.grid, result.cell);
      setMessage(result.message, 'ng');
      break;
    case 'ngShown':
      setMessage(result.message, 'shown');
      break;
    case 'tooBig':
      setMessage(result.message, 'think');
      break;
    case 'cantSubtract':
      shakeCell(dom.grid, result.cell);
      setMessage(result.message, 'think');
      break;
    default:
      if (result.note) setMessage(result.note, 'info');
      else if (result.stepDone) setMessage('いいね、つぎへ', 'ok');
      else setMessage('', 'info');
  }

  if (result.problemDone) finishProblem();
}

function finishProblem() {
  const summary = J.summarize(state.session);
  state.summaries.push(summary);
  state.stats = addProblem(state.stats, summary, today());
  saveStats(state.stats);
  setProgress();

  const last = state.index >= ROUND_SIZE - 1;
  dom.next.textContent = last ? 'けっかを みる' : 'つぎの もんだい';
  setPadMode('next');
  setMessage(summary.perfect ? 'できた！ ぜんぶ じぶんで とけたね' : 'できた！', 'ok');
}

function goNext() {
  if (state.index >= ROUND_SIZE - 1) {
    finishRound();
    return;
  }
  state.index += 1;
  loadProblem();
}

function finishRound() {
  const beforeXp = state.stats.xp;
  const result = roundResult(state.level, state.summaries);
  state.stats = addRound(state.stats, state.level, result.xp, today());
  saveStats(state.stats);
  const change = titleChange(beforeXp, state.stats.xp);
  renderRoundResult(dom.resultBody, result, state.stats, change);
  showScreen('result');
}

// ---- ホーム・きろく -----------------------------------------------------

function goHome() {
  state.session = null;
  renderHomeBadges(dom.levelList, state.stats);
  renderHomeTitle(dom.homeTitle, state.stats);
  showScreen('home');
}

function goRecord() {
  renderRecord(dom.recordBody, state.stats);
  hideResetConfirm();
  showScreen('record');
}

function hideResetConfirm() {
  dom.resetConfirm.hidden = true;
  dom.resetButton.hidden = false;
}

function resetData() {
  state.stats = clearStats();
  renderRecord(dom.recordBody, state.stats);
  renderHomeBadges(dom.levelList, state.stats);
  renderHomeTitle(dom.homeTitle, state.stats);
  hideResetConfirm();
}

// ---- くみたて -----------------------------------------------------------

function wire() {
  dom.levelList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-level]');
    if (button) startRound(Number(button.dataset.level));
  });

  dom.hint.addEventListener('click', () => {
    if (state.session && !state.session.done) setMessage(J.hintOf(state.session), 'hint');
  });

  dom.next.addEventListener('click', goNext);
  dom.quit.addEventListener('click', goHome);
  dom.again.addEventListener('click', () => startRound(state.level));

  for (const button of document.querySelectorAll('[data-go="home"]')) {
    button.addEventListener('click', goHome);
  }
  for (const button of document.querySelectorAll('[data-go="record"]')) {
    button.addEventListener('click', goRecord);
  }

  dom.resetButton.addEventListener('click', () => {
    dom.resetButton.hidden = true;
    dom.resetConfirm.hidden = false;
  });
  dom.resetYes.addEventListener('click', resetData);
  dom.resetNo.addEventListener('click', hideResetConfirm);

  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 200));
}

function boot() {
  Object.assign(dom, {
    levelList: pick('level-list'),
    homeTitle: pick('home-title'),
    grid: pick('grid'),
    stage: pick('stage'),
    message: pick('message'),
    keypad: pick('keypad'),
    padArea: pick('pad-area'),
    hint: pick('hint'),
    next: pick('next'),
    quit: pick('quit'),
    progress: pick('progress'),
    dots: pick('dots'),
    levelName: pick('level-name'),
    expr: pick('expr'),
    resultBody: pick('result-body'),
    recordBody: pick('record-body'),
    again: pick('again'),
    resetButton: pick('reset'),
    resetConfirm: pick('reset-confirm'),
    resetYes: pick('reset-yes'),
    resetNo: pick('reset-no'),
    warning: pick('storage-warning'),
  });

  state.stats = loadStats();
  buildKeypad(dom.keypad, onDigit);
  wire();
  renderHomeBadges(dom.levelList, state.stats);
  renderHomeTitle(dom.homeTitle, state.stats);
  dom.warning.hidden = storageWorks();
  showScreen('home');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // オフラインにできなくても れんしゅうは できる
      });
    });
  }
}

boot();

export { LEVELS };
