// ステップ列と筆算のマス配置（layout）をつくる純粋モジュール。
// UI は rows / steps を見て描くだけで、筆算のきまりを知らなくてよい。

import { trace, tooBigCandidates } from './problem.js';

export const KINDS = ['tateru', 'kakeru', 'hiku', 'orosu'];

export const KIND_LABELS = {
  tateru: 'たてる',
  kakeru: 'かける',
  hiku: 'ひく',
  orosu: 'おろす',
};

/** 行 id と けた（列）から マス id をつくる。全マスこの形。 */
export function cellIdAt(rowId, col) {
  return `${rowId}#${col}`;
}

function tensOf(divisor) {
  return Math.floor(divisor / 10);
}

const FROM_ONES = '1の くらいから じゅんばんに';

/**
 * 入力する順にならべかえる。
 * 2けた以上は くりあがり・くりさがりが あるので、1の くらい（右）から 入れさせる。
 */
function inputOrder(cellsByColumn) {
  return cellsByColumn.length > 1 ? cellsByColumn.slice().reverse() : cellsByColumn;
}

function tateruHint(stage, divisor, isFirst, leadDigit) {
  const head = isFirst && leadDigit !== null
    ? `${leadDigit} は ${divisor} で われないから、${stage.partial} で かんがえるよ。`
    : '';
  if (divisor < 10) {
    return `${head}${stage.partial} の なかに ${divisor} は いくつ あるかな。${divisor} の だんの くくで さがそう`;
  }
  return `${head}${divisor} を ${tensOf(divisor)}0 と みて、${stage.partial} の なかに いくつ あるか みつもろう`;
}

/**
 * 1問ぶんの筆算データをつくる。
 * rows:  上から順の行。cells は けた→マスid。
 * steps: 入力の順番。step.cells は「入力する順」であって けた順ではない。
 *        2けた以上は くりあがり・くりさがりが あるので、かならず 1の くらい（右）から。
 */
export function buildDrill(problem) {
  const { dividend, divisor } = problem;
  const t = trace(dividend, divisor);
  const cols = t.digits.length;
  const leadDigit = t.quotientDigits[0] === null ? t.digits[0] : null;

  const quotientRow = { id: 'q', kind: 'quotient', cells: {} };
  const dividendRow = { id: 'd', kind: 'dividend', cells: {}, left: String(divisor) };
  const rows = [quotientRow, dividendRow];

  const values = {};
  const given = [];
  for (let col = 0; col < cols; col++) {
    const id = cellIdAt('d', col);
    dividendRow.cells[col] = id;
    values[id] = String(t.digits[col]);
    given.push(id);
  }

  const steps = [];
  let openRow = dividendRow;

  t.stages.forEach((stage, s) => {
    const info = {
      stage: s,
      col: stage.col,
      partial: stage.partial,
      q: stage.q,
      product: stage.product,
      rest: stage.rest,
      divisor,
    };

    // ① たてる
    const qCell = cellIdAt('q', stage.col);
    quotientRow.cells[stage.col] = qCell;
    values[qCell] = String(stage.q);
    steps.push({
      id: `t${s}`,
      kind: 'tateru',
      stage: s,
      cells: [{ cell: qCell, expect: String(stage.q) }],
      hint: tateruHint(stage, divisor, s === 0, leadDigit),
      ng: 'もう いちど みつもって みよう',
      // 仮の商が大きすぎるときに「ひけない」ことで気づかせる（2けたで わるときだけ）
      tooBig: divisor >= 10 && stage.q > 0 ? tooBigCandidates(stage, divisor) : [],
      after: stage.q === 0
        ? '0 を たてたら、かけざんと ひきざんは とばして、つぎの かずを おろすよ'
        : null,
      info,
    });

    if (stage.q > 0) {
      // ② かける
      const pRow = { id: `p${s}`, kind: 'product', stage: s, cells: {} };
      const pDigits = String(stage.product).split('');
      const pFrom = stage.col - pDigits.length + 1;
      const pCells = pDigits.map((ch, i) => {
        const col = pFrom + i;
        const id = cellIdAt(pRow.id, col);
        pRow.cells[col] = id;
        values[id] = ch;
        return { cell: id, expect: ch };
      });
      rows.push(pRow);
      const kakeruMulti = pCells.length > 1;
      steps.push({
        id: `k${s}`,
        kind: 'kakeru',
        stage: s,
        cells: inputOrder(pCells),
        hint: kakeruMulti
          ? `${divisor} × ${stage.q} を けいさんして、${stage.partial} の したに かくよ。${FROM_ONES}`
          : `${divisor} × ${stage.q} を けいさんして、${stage.partial} の したに かくよ`,
        ng: kakeruMulti
          ? `${divisor} × ${stage.q} だよ。くりあがりに きを つけよう`
          : `${divisor} × ${stage.q} を もう いちど けいさんしよう`,
        info,
      });

      // ③ ひく
      const rRow = {
        id: `r${s}`,
        kind: 'rest',
        stage: s,
        cells: {},
        rule: { from: pFrom, to: stage.col },
      };
      const rDigits = String(stage.rest).split('');
      const rFrom = stage.col - rDigits.length + 1;
      const rByColumn = rDigits.map((ch, i) => {
        const col = rFrom + i;
        const id = cellIdAt(rRow.id, col);
        rRow.cells[col] = id;
        values[id] = ch;
        return { cell: id, expect: ch };
      });
      rows.push(rRow);
      const hikuMulti = rByColumn.length > 1;
      steps.push({
        id: `h${s}`,
        kind: 'hiku',
        stage: s,
        cells: inputOrder(rByColumn),
        hint: hikuMulti
          ? `${stage.partial} から ${stage.product} を ひくよ。${FROM_ONES}`
          : `${stage.partial} から ${stage.product} を ひくよ`,
        ng: hikuMulti
          ? `${stage.partial} ー ${stage.product} だよ。くりさがりに きを つけよう`
          : `${stage.partial} ー ${stage.product} を もう いちど けいさんしよう`,
        info,
      });

      openRow = rRow;
    }

    // ④ おろす（つぎの段があるときだけ）
    const next = t.stages[s + 1];
    if (next) {
      const digit = String(t.digits[next.col]);
      const id = cellIdAt(openRow.id, next.col);
      openRow.cells[next.col] = id;
      values[id] = digit;
      steps.push({
        id: `o${s}`,
        kind: 'orosu',
        stage: s,
        cells: [{ cell: id, expect: digit }],
        hint: `つぎの くらいの ${digit} を したに おろすよ`,
        ng: 'おろすのは わられるかず の つぎの くらいの かずだよ',
        info: { ...info, digit: Number(digit), nextPartial: next.partial },
      });
    }
  });

  const inColumnOrder = (row) => Object.keys(row.cells)
    .map(Number)
    .sort((a, b) => a - b)
    .map((col) => row.cells[col]);

  return {
    problem,
    cols,
    rows,
    steps,
    values,
    given,
    quotientCells: inColumnOrder(quotientRow),
    remainderCells: inColumnOrder(openRow),
    cellCount: steps.reduce((n, st) => n + st.cells.length, 0),
  };
}

/**
 * 仮の商 trial が大きすぎたときに書かせる「かける」ステップ。
 * 正しいステップ列は変えず、その場かぎりで差しこむ。
 */
export function buildFixStep(drill, stepIndex, trial) {
  const step = drill.steps[stepIndex];
  const { divisor, partial, stage, col } = step.info;
  const product = trial * divisor;
  const digits = String(product).split('');
  const from = col - digits.length + 1;
  const rowId = `p${stage}`;
  const cells = digits.map((ch, i) => ({ cell: cellIdAt(rowId, from + i), expect: ch }));
  const multi = cells.length > 1;
  return {
    id: `fix-${step.id}-${trial}`,
    kind: 'kakeru',
    stage,
    fix: true,
    trial,
    cells: inputOrder(cells),
    hint: multi
      ? `${divisor} × ${trial} を けいさんして、したに かいてみよう。${FROM_ONES}`
      : `${divisor} × ${trial} を けいさんして、したに かいてみよう`,
    ng: multi
      ? `${divisor} × ${trial} だよ。くりあがりに きを つけよう`
      : `${divisor} × ${trial} を もう いちど けいさんしよう`,
    info: { ...step.info, q: trial, product },
  };
}

/** マスに入る正解を読む（テスト・ヒント用）。 */
export function readCells(drill, filled, cells) {
  return cells.map((id) => filled[id] ?? '').join('');
}
