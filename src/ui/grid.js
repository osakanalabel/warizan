// 筆算のマスを描く。どこに何のマスがあるかは core/steps.js の layout にしたがう。

import { cellIdAt } from '../core/steps.js';
import { activeCell, stepCells } from '../core/judge.js';

const MAX_CELL = 52;
const MIN_CELL = 24;

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/** 1問ぶんのマスをつくる。すべての行・けたにマスを置くので、あとから増えても描ける。 */
export function buildGrid(gridEl, drill) {
  gridEl.textContent = '';
  gridEl.style.setProperty('--cols', String(drill.cols + 1));
  gridEl.style.setProperty('--rows', String(drill.rows.length));

  for (const row of drill.rows) {
    const rowEl = el('div', `row row--${row.kind}`);
    const left = el('div', 'cell cell--left');
    if (row.left) left.textContent = row.left;
    rowEl.append(left);

    for (let col = 0; col < drill.cols; col++) {
      const cell = el('div', 'cell');
      cell.dataset.cell = cellIdAt(row.id, col);
      if (row.cells[col]) cell.classList.add('cell--used');
      if (row.rule && col >= row.rule.from && col <= row.rule.to) {
        cell.classList.add('cell--rule');
      }
      rowEl.append(cell);
    }
    gridEl.append(rowEl);
  }
}

/** いまの状態をマスに写す。 */
export function updateGrid(gridEl, session) {
  const active = activeCell(session);
  const targets = new Set(stepCells(session));

  for (const cell of gridEl.querySelectorAll('[data-cell]')) {
    const id = cell.dataset.cell;
    const value = session.filled[id];
    if (cell.textContent !== (value ?? '')) cell.textContent = value ?? '';
    cell.classList.toggle('is-filled', value !== undefined);
    cell.classList.toggle('is-active', id === active);
    cell.classList.toggle('is-target', targets.has(id) && value === undefined && id !== active);
    cell.classList.toggle('is-wrong', session.wrongCells.includes(id));
    cell.classList.toggle('is-shown', session.shownAnswer.includes(id));
  }
}

/** まちがえたマスをふるわせる。 */
export function shakeCell(gridEl, cellId) {
  const cell = gridEl.querySelector(`[data-cell="${cellId}"]`);
  if (!cell) return;
  cell.classList.remove('shake');
  void cell.offsetWidth; // アニメーションをやり直させる
  cell.classList.add('shake');
}

/** 画面の大きさに合わせてマスの一辺を決める（iPhone 12 mini でも はみ出さないように）。 */
export function fitGrid(stageEl, gridEl, drill) {
  const availW = stageEl.clientWidth - 8;
  const availH = stageEl.clientHeight - 8;
  const cols = drill.cols + 1;
  const rows = drill.rows.length;
  const size = Math.min(availW / cols, availH / rows, MAX_CELL);
  gridEl.style.setProperty('--cell', `${Math.max(MIN_CELL, Math.floor(size))}px`);
}

/** いま入力するマスが見えるところまでスクロールする。 */
export function revealActive(stageEl, gridEl, session) {
  const id = activeCell(session);
  if (!id) return;
  const cell = gridEl.querySelector(`[data-cell="${id}"]`);
  if (!cell) return;
  const top = cell.offsetTop;
  const bottom = top + cell.offsetHeight;
  if (top < stageEl.scrollTop) stageEl.scrollTop = Math.max(0, top - 8);
  else if (bottom > stageEl.scrollTop + stageEl.clientHeight) {
    stageEl.scrollTop = bottom - stageEl.clientHeight + 8;
  }
}
