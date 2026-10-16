// Máquina de Turing determinística de k cintas (teoría de la cátedra, UNCPBA).
// MT = <E, A, C, δ, e0, B, F>,  δ: E × Cᵏ → E × (C × {I, D, N})ᵏ
// - Cada cinta tiene celda de inicio y es infinita a derecha; B es el blanco.
// - La entrada va en la cinta 1; las demás arrancan en blanco. Cabezas en la celda 0.
// - Acepta al llegar a un estado final. Si δ no está definida, se detiene y rechaza.
// Pura: no toca el DOM.

export const BLANK = 'B';
export const MOVES = ['I', 'D', 'N'];
const MAX_STEPS = 1000; // ponytail: corta MT que no se detienen; subir si un ejercicio necesita más

const DELTA = { I: -1, D: 1, N: 0 };

// C = A ∪ {B} ∪ auxiliares
export function tapeSymbols({ alphabet, tapeAlphabet }) {
  return [...new Set([...alphabet, BLANK, ...tapeAlphabet])];
}

export function simulateMT({ states, transitions, alphabet, tapeCount }, input) {
  const startState = states.find(s => s.isStart);
  const label = id => states.find(s => s.id === id).label;

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
  let current = startState.id;
  const snapshot = extra => ({ state: current, tapes: tapes.map(t => [...t]), heads: [...heads], ...extra });
  const trace = [snapshot({ symbol: null })];
  const accept = () => ({ result: 'accepted', msg: `✓ Cadena aceptada · ${label(current)} es final`, trace });

  if (startState.isFinal) return accept();

  for (let steps = 0; steps < MAX_STEPS; steps++) {
    const reads = tapes.map((t, i) => t[heads[i]] ?? BLANK);
    const trans = transitions.find(t =>
      t.from === current && t.reads.every((r, i) => r === reads[i])
    );
    if (!trans) {
      return { result: 'rejected', msg: `✗ Se detuvo en ${label(current)} (no final): δ(${label(current)}, ${reads.join(', ')}) no está definida`, trace };
    }

    const leftEdge = trans.moves.findIndex((m, i) => m === 'I' && heads[i] === 0);
    if (leftEdge !== -1) {
      return { result: 'rejected', msg: `✗ Movimiento a izquierda de la celda de inicio (cinta ${leftEdge + 1})`, trace };
    }

    trans.writes.forEach((w, i) => { tapes[i][heads[i]] = w; });
    trans.moves.forEach((m, i) => { heads[i] += DELTA[m]; });
    current = trans.to;
    trace.push(snapshot({ symbol: reads.join(','), transitionId: trans.id }));

    if (states.find(s => s.id === current).isFinal) return accept();
  }

  return { result: 'warning', msg: `⚠ La MT no se detuvo en ${MAX_STEPS} pasos (¿bucle infinito?)`, trace: [] };
}

// δ es función: no puede haber dos transiciones desde el mismo estado leyendo lo mismo.
export function findConflictMT(transitions, from, reads) {
  return transitions.find(t => t.from === from && t.reads.every((r, i) => r === reads[i]));
}

// Notación del diagrama de la cursada: "a,B/<a,D><X,D>"
export function mtLabel(t) {
  return `${t.reads.join(',')}/${t.writes.map((w, i) => `<${w},${t.moves[i]}>`).join('')}`;
}

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
