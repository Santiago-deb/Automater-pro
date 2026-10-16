// Máquina de Turing determinística de k cintas (teoría de la cátedra, UNCPBA).
// MT = <E, A, C, δ, e0, B, F>,  δ: E × Cᵏ → E × (C × {I, D, N})ᵏ
// - Cada cinta tiene celda de inicio y es infinita a derecha; B es el blanco.
// - La entrada va en la cinta 1; las demás arrancan en blanco. Cabezas en la celda 0.
// - Acepta al llegar a un estado final. Si δ no está definida, se detiene y rechaza.
// - Composición (como MTSolution): una transición puede llamar a una sub-máquina
//   (MT, AP o AF) después de escribir y mover. Las cintas y las cabezas pasan por
//   referencia, y según el resultado la MT sigue en el estado de aceptación (to),
//   de rechazo (call.reject) o sin respuesta (call.none).
// Pura: no toca el DOM.
import { simulateAF, afConflict } from './af.js';
import { simulateAPD, apdConflict } from './apd.js';

export const BLANK = 'B';
export const MOVES = ['I', 'D', 'N'];
const MAX_STEPS = 1000; // ponytail: corta MT que no se detienen; subir si un ejercicio necesita más
const MAX_TOTAL = 100000; // pasos sumando las sub-máquinas
const MAX_DEPTH = 16;

const DELTA = { I: -1, D: 1, N: 0 };

// C = A ∪ {B} ∪ auxiliares
export function tapeSymbols({ alphabet, tapeAlphabet }) {
  return [...new Set([...alphabet, BLANK, ...tapeAlphabet])];
}

export function simulateMT({ states, transitions, alphabet, tapeCount, modules }, input) {
  const startState = states.find(s => s.isStart);
  if (!startState) return { result: 'warning', msg: '⚠ Define un estado inicial', trace: [] };
  if (alphabet.length === 0) return { result: 'warning', msg: '⚠ Define el alfabeto de entrada', trace: [] };
  if (alphabet.includes(BLANK)) return { result: 'warning', msg: `⚠ ${BLANK} es el blanco: no puede estar en el alfabeto de entrada`, trace: [] };

  for (const ch of input) {
    if (!alphabet.includes(ch)) {
      return { result: 'rejected', msg: `✗ "${ch}" no pertenece al alfabeto de entrada`, trace: [] };
    }
  }

  const tapes = Array.from({ length: tapeCount }, (_, i) => (i === 0 ? input.split('') : []));
  const heads = Array(tapeCount).fill(0);
  const trace = [];
  const r = runMT({ states, transitions, modules }, tapes, heads, { budget: { left: MAX_TOTAL }, depth: 0 },
    step => trace.push({ ...step, tapes: tapes.map(t => [...t]), heads: [...heads] }));
  if (r.result === 'none') return { result: 'warning', msg: `⚠ La MT no se detuvo en ${MAX_STEPS} pasos (¿bucle infinito?)`, trace: [] };
  if (r.result === 'error') return { result: 'warning', msg: `⚠ ${r.msg}`, trace: [] };
  return { result: r.result, msg: r.msg, trace };
}

// Corre una MT desde su estado inicial sobre cintas y cabezas que recibe y modifica
// (así pasan "por referencia" a una sub-máquina). Devuelve result:
// 'accepted' | 'rejected' | 'none' (no se detuvo) | 'error' (módulo faltante, etc.).
function runMT({ states, transitions, modules = {} }, tapes, heads, ctx, onStep = () => {}) {
  const label = id => states.find(s => s.id === id)?.label ?? '?';
  let current = states.find(s => s.isStart)?.id;
  if (current === undefined) return { result: 'error', msg: 'Una sub-máquina no tiene estado inicial' };
  const accept = () => ({ result: 'accepted', msg: `✓ Cadena aceptada · ${label(current)} es final` });
  onStep({ state: current, symbol: null });
  if (states.find(s => s.id === current).isFinal) return accept();

  for (let steps = 0; steps < MAX_STEPS; steps++) {
    if (--ctx.budget.left < 0) return { result: 'error', msg: `Se superaron ${MAX_TOTAL} pasos sumando las sub-máquinas` };
    const reads = tapes.map((t, i) => t[heads[i]] ?? BLANK);
    const trans = transitions.find(t =>
      t.from === current && t.reads.every((r, i) => r === reads[i])
    );
    if (!trans) {
      return { result: 'rejected', msg: `✗ Se detuvo en ${label(current)} (no final): δ(${label(current)}, ${reads.join(', ')}) no está definida` };
    }

    const leftEdge = trans.moves.findIndex((m, i) => m === 'I' && heads[i] === 0);
    if (leftEdge !== -1) {
      return { result: 'rejected', msg: `✗ Movimiento a izquierda de la celda de inicio (cinta ${leftEdge + 1})` };
    }

    trans.writes.forEach((w, i) => { tapes[i][heads[i]] = w; });
    trans.moves.forEach((m, i) => { heads[i] += DELTA[m]; });
    let symbol = reads.join(',');
    if (trans.call) {
      const r = callModule(modules[trans.call.alias], trans.call, tapes, heads, ctx);
      if (r.result === 'error') return r;
      const next = { accepted: trans.to, rejected: trans.call.reject, none: trans.call.none }[r.result];
      if (next == null) return { result: 'none', msg: r.msg };
      symbol += ` @${trans.call.alias} ${CALL_MARK[r.result]}`;
      current = next;
    } else {
      current = trans.to;
    }
    onStep({ state: current, symbol, transitionId: trans.id });

    if (states.find(s => s.id === current)?.isFinal) return accept();
  }
  return { result: 'none', msg: `No se detuvo en ${MAX_STEPS} pasos` };
}

const CALL_MARK = { accepted: '✓', rejected: '✗', none: '∞' };

// Llamada @alias(...): una MT recibe las cintas pedidas; un AF o un AP lee de su
// única cinta la palabra que va desde la cabeza hasta el primer blanco, y la
// cabeza queda sobre ese blanco.
function callModule(mod, call, tapes, heads, ctx) {
  const a = mod?.automaton;
  if (!a) return { result: 'error', msg: `Falta cargar el módulo ${call.alias}${mod?.file ? ` (${mod.file})` : ''}` };
  if (ctx.depth >= MAX_DEPTH) return { result: 'error', msg: `Demasiadas llamadas anidadas (más de ${MAX_DEPTH}): ¿una sub-máquina se llama a sí misma?` };
  if (a.type === 'mt') {
    if (call.tapes.length !== a.tapeCount) {
      return { result: 'error', msg: `@${call.alias} usa ${a.tapeCount} cinta(s) y la llamada le pasa ${call.tapes.length}` };
    }
    const subHeads = call.tapes.map(i => heads[i]);
    const r = runMT(a, call.tapes.map(i => tapes[i]), subHeads, { ...ctx, depth: ctx.depth + 1 });
    call.tapes.forEach((i, j) => { heads[i] = subHeads[j]; });
    return r;
  }
  const i = call.tapes[0];
  const tape = tapes[i];
  let end = heads[i];
  while ((tape[end] ?? BLANK) !== BLANK) end++;
  const word = tape.slice(heads[i], end).join('');
  heads[i] = end;
  const r = (a.type === 'apd' ? simulateAPD : simulateAF)(a, word);
  if (r.result === 'warning') return { result: 'error', msg: `@${call.alias}: ${r.msg.replace(/^⚠\s*/, '')}` };
  return { result: r.result };
}

// La llamada como la escribe MTSolution: @Copiar(e1, e2, (C1, C3))
export function callText(t, label) {
  const { alias, reject, none, tapes } = t.call;
  const targets = [t.to, reject, ...(none != null ? [none] : [])].map(label);
  return `@${alias}(${targets.join(', ')}, (${tapes.map(i => `C${i + 1}`).join(', ')}))`;
}

// Primer conflicto de no determinismo, también dentro de las sub-máquinas: { msg, states } o null.
export function mtConflict({ states, transitions, modules = {} }, seen = new Set()) {
  const label = id => states.find(s => s.id === id)?.label ?? '?';
  for (const [i, t] of transitions.entries()) {
    if (findConflictMT(transitions.slice(i + 1), t.from, t.reads)) {
      return { msg: `δ(${label(t.from)}, ${t.reads.join(', ')}) está definida más de una vez`, states: [t.from] };
    }
  }
  for (const [alias, { automaton: a }] of Object.entries(modules)) {
    if (!a || seen.has(a)) continue;
    seen.add(a);
    const c = a.type === 'mt' ? mtConflict(a, seen) : (a.type === 'apd' ? apdConflict : afConflict)(a);
    if (c) return { msg: `la sub-máquina @${alias} es no determinística: ${c.msg}`, states: [] };
  }
  return null;
}

// δ es función: no puede haber dos transiciones desde el mismo estado leyendo lo mismo.
export function findConflictMT(transitions, from, reads) {
  return transitions.find(t => t.from === from && t.reads.every((r, i) => r === reads[i]));
}

// Notación del diagrama de la cursada: "a,B/<a,D><X,D>"
export function mtLabel(t) {
  return `${t.reads.join(',')}/${t.writes.map((w, i) => `<${w},${t.moves[i]}>`).join('')}`;
}

// Rótulo corto de la llamada en el diagrama: "@Copiar(C1,C3)"
export const callLabel = ({ alias, tapes }) => `@${alias}(${tapes.map(i => `C${i + 1}`).join(',')})`;

// Notación de δ: 1 cinta "δ(q0, a) = (q1, X, D)"; k cintas "δ(q0, a, B) = (q1, (a,N), (X,D))"
export function mtDelta(t, fromLabel, toLabel) {
  const out = t.writes.length === 1
    ? `${t.writes[0]}, ${t.moves[0]}`
    : t.writes.map((w, i) => `(${w},${t.moves[i]})`).join(', ');
  return `δ(${fromLabel}, ${t.reads.join(', ')}) = (${toLabel}, ${out})`;
}

// Configuración α₁ eᵢ α₂ de una cinta (sin los blancos sobrantes a derecha).
export function configuration(tape, head, stateLabel) {
  const cells = [...tape];
  while (cells.length > head + 1 && cells[cells.length - 1] === BLANK) cells.pop();
  const left = cells.slice(0, head).join('');
  const right = cells.slice(head).join('') || BLANK;
  return `${left} ${stateLabel} ${right}`.trim();
}
