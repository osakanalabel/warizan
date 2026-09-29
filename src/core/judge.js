// 1マスずつの判定エンジン。純粋関数として書き、状態は毎回新しいオブジェクトで返す。

import { buildDrill, buildFixStep, KINDS, readCells } from './steps.js';

export const ALLOW_WRONG = 2; // 同じマスで2回まちがえたら正解を見せて つぎへ

export function createSession(problem) {
  const drill = buildDrill(problem);
  const filled = {};
  for (const id of drill.given) filled[id] = drill.values[id];
  return {
    problem,
    drill,
    stepIndex: 0,
    inputIndex: 0,
    filled,
    wrongCells: [],
    wrongStreak: 0,
    attempts: 0,
    attemptsOk: 0,
    errors: Object.fromEntries(KINDS.map((k) => [k, 0])),
    mode: 'normal',
    fixStep: null,
    shownAnswer: [],
    done: false,
  };
}

function clone(s) {
  return {
    ...s,
    filled: { ...s.filled },
    wrongCells: s.wrongCells.slice(),
    errors: { ...s.errors },
    shownAnswer: s.shownAnswer.slice(),
  };
}

export function currentStep(s) {
  if (s.done) return null;
  return s.mode === 'fixing' ? s.fixStep : s.drill.steps[s.stepIndex];
}

export function activeCell(s) {
  const step = currentStep(s);
  return step ? step.cells[s.inputIndex].cell : null;
}

/** いま入力中のステップに属するマス（光らせる範囲）。 */
export function stepCells(s) {
  const step = currentStep(s);
  return step ? step.cells.map((c) => c.cell) : [];
}

export function hintOf(s) {
  const step = currentStep(s);
  return step ? step.hint : '';
}

export function progressOf(s) {
  const done = s.drill.steps
    .slice(0, s.stepIndex)
    .reduce((n, st) => n + st.cells.length, 0) + (s.mode === 'normal' ? s.inputIndex : 0);
  return { done, total: s.drill.cellCount };
}

export function readQuotient(s) {
  return readCells(s.drill, s.filled, s.drill.quotientCells);
}

export function readRemainder(s) {
  return readCells(s.drill, s.filled, s.drill.remainderCells);
}

export function isPerfect(s) {
  return s.attempts === s.attemptsOk && s.shownAnswer.length === 0;
}

export function summarize(s) {
  return {
    level: s.problem.level,
    attempts: s.attempts,
    attemptsOk: s.attemptsOk,
    perfect: isPerfect(s),
    errors: { ...s.errors },
  };
}

function tooSmallOrBig(step, digit) {
  const { divisor, partial } = step.info;
  const product = divisor * digit;
  if (product > partial) {
    return `${divisor} × ${digit} は ${product} で、${partial} より おおきく なるよ`;
  }
  return 'まだ もっと おおきく できるよ';
}

function ngMessage(step, digit) {
  if (step.kind === 'tateru' && !step.fix) return tooSmallOrBig(step, digit);
  return step.ng;
}

/** 正解を見せてマスを埋め、つぎへ進める。 */
function reveal(s, step, slot) {
  s.filled[slot.cell] = slot.expect;
  s.wrongCells = s.wrongCells.filter((c) => c !== slot.cell);
  s.shownAnswer.push(slot.cell);
  s.wrongStreak = 0;
  return advance(s, step);
}

/** ステップ内のつぎのマス、またはつぎのステップへ。 */
function advance(s, step) {
  s.inputIndex += 1;
  if (s.inputIndex < step.cells.length) return { finishedStep: false };
  s.inputIndex = 0;
  return { finishedStep: true };
}

/** 仮の商が大きすぎたとき、書いた積と商を消してやりなおしに戻す。 */
function rewindOverEstimate(s) {
  const step = s.fixStep;
  const { partial, product, divisor, q } = step.info;
  for (const c of step.cells) delete s.filled[c.cell];
  const tateru = s.drill.steps[s.stepIndex];
  const qCell = tateru.cells[0].cell;
  delete s.filled[qCell];
  s.wrongCells = [...new Set([...s.wrongCells, qCell])];
  s.mode = 'normal';
  s.fixStep = null;
  s.inputIndex = 0;
  s.wrongStreak = 1; // つぎも まちがえたら 正解を見せる
  s.errors.tateru += 1;
  return {
    status: 'cantSubtract',
    kind: 'tateru',
    cell: qCell,
    message: `${partial} から ${product} は ひけないね。${divisor} × ${q} が おおきすぎたよ。しょうを 1 ちいさく して やりなおそう`,
  };
}

/**
 * キーパッドの数字を1つ入れる。
 * result.status は入力の判定 (ok / ng / ngShown / tooBig / cantSubtract / ignored)、
 * result.stepDone / result.problemDone は進みぐあい、result.note は そのとき出す ひとこと。
 */
export function input(session, digit) {
  if (session.done) return { session, result: base({ status: 'ignored', message: '' }) };

  const s = clone(session);
  const step = currentStep(s);
  const slot = step.cells[s.inputIndex];
  const ch = String(digit);
  s.attempts += 1;

  // --- まちがい ---
  if (ch !== slot.expect) {
    const n = Number(ch);

    // 2けたで わるとき、大きすぎる仮の商は いったん受け入れて「ひけない」ことに気づかせる
    if (
      step.kind === 'tateru' && !step.fix && s.mode === 'normal'
      && s.wrongStreak === 0 && step.tooBig.includes(n)
    ) {
      s.filled[slot.cell] = ch;
      s.mode = 'fixing';
      s.fixStep = buildFixStep(s.drill, s.stepIndex, n);
      s.inputIndex = 0;
      return {
        session: s,
        result: {
          status: 'tooBig',
          kind: 'tateru',
          cell: slot.cell,
          message: `ほんとうに はいるかな。${step.info.divisor} × ${n} を したに かいて たしかめよう`,
        },
      };
    }

    s.wrongStreak += 1;
    s.errors[step.kind] += 1;
    s.wrongCells = [...new Set([...s.wrongCells, slot.cell])];

    if (s.wrongStreak >= ALLOW_WRONG) {
      const { finishedStep } = reveal(s, step, slot);
      return {
        session: s,
        result: finish(s, step, finishedStep, {
          status: 'ngShown',
          kind: step.kind,
          cell: slot.cell,
          message: `こたえは ${slot.expect} だよ。つぎに すすもう`,
        }),
      };
    }

    return {
      session: s,
      result: base({
        status: 'ng',
        kind: step.kind,
        cell: slot.cell,
        message: ngMessage(step, n),
      }),
    };
  }

  // --- 正解 ---
  s.attemptsOk += 1;
  s.filled[slot.cell] = ch;
  s.wrongCells = s.wrongCells.filter((c) => c !== slot.cell);
  s.wrongStreak = 0;
  const { finishedStep } = advance(s, step);
  return {
    session: s,
    result: finish(s, step, finishedStep, {
      status: 'ok',
      kind: step.kind,
      cell: slot.cell,
      message: '',
    }),
  };
}

function base(result) {
  return { stepDone: false, problemDone: false, note: null, ...result };
}

/** マスを埋めたあとの後始末。ステップが終わっていれば つぎへ進める。 */
function finish(s, step, finishedStep, result) {
  if (!finishedStep) return base(result);

  if (s.mode === 'fixing') {
    // 大きすぎる積を書き終えた → ひけないことに気づかせて もどす
    return base(rewindOverEstimate(s));
  }

  s.stepIndex += 1;
  if (s.stepIndex >= s.drill.steps.length) {
    s.done = true;
    return base({
      ...result,
      stepDone: true,
      problemDone: true,
      message: result.status === 'ok' ? 'できた！' : result.message,
    });
  }
  return base({ ...result, stepDone: true, note: step.after ?? null });
}
