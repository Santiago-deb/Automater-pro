// Simulación de APD (aceptación por estado final). Pura: no toca el DOM.
// Devuelve { result, msg, trace }; cada paso del trace lleva la config completa
// { state, symbol, remaining, stack, output, transitionId? } para animarla.

const MAX_STEPS = 200; // ponytail: corta bucles ε infinitos; subir si hay autómatas legítimamente largos

export function simulateAPD({ states, transitions, alphabet, initialStackSymbol }, input) {
  const startState = states.find(s => s.isStart);

  if (!startState) return { result: 'warning', msg: '⚠ Define un estado inicial', trace: [] };
  if (alphabet.length === 0) return { result: 'warning', msg: '⚠ Define el alfabeto de entrada', trace: [] };
  if (!initialStackSymbol) return { result: 'warning', msg: '⚠ Define Z₀ (símbolo inicial de pila)', trace: [] };

  for (const ch of input) {
    if (!alphabet.includes(ch)) {
      return { result: 'rejected', msg: `✗ "${ch}" no pertenece al alfabeto de entrada`, trace: [] };
    }
  }

  let current = startState.id;
  let remaining = input;
  const stack = [initialStackSymbol];
  let output = '';
  let stuck = false;
  let halted = false;
  const top = () => stack[stack.length - 1];
  const epsilonFrom = (state, stackTop) =>
    transitions.find(t => t.from === state && t.stackTop === stackTop && t.isEpsilon);

  const trace = [{ state: current, symbol: null, remaining, stack: [...stack], output }];

  for (let steps = 0; steps < MAX_STEPS; steps++) {
    let trans = null;
    if (remaining.length > 0) {
      trans = transitions.find(t =>
        t.from === current && t.stackTop === top() && t.symbol === remaining[0] && !t.isEpsilon
      );
    }
    if (!trans) trans = epsilonFrom(current, top());
    if (!trans) { stuck = true; halted = true; break; }

    if (!trans.isEpsilon) remaining = remaining.slice(1);

    // El primer símbolo de stackReplace queda en el tope.
    stack.pop();
    const toPush = (trans.stackReplace || '').split('').filter(c => c !== ' ');
    for (let i = toPush.length - 1; i >= 0; i--) stack.push(toPush[i]);

    if (trans.output) output += trans.output;
    current = trans.to;

    trace.push({
      state: current, symbol: trans.isEpsilon ? null : trans.symbol,
      remaining, stack: [...stack], output, transitionId: trans.id
    });

    const isFinal = states.find(s => s.id === current).isFinal;
    if (remaining === '' && isFinal && !epsilonFrom(current, top())) { halted = true; break; }
    if (stack.length === 0) { stuck = true; halted = true; break; }
  }

  if (!halted) return { result: 'warning', msg: '⚠ Posible bucle infinito de transiciones ε', trace: [] };

  const finalState = states.find(s => s.id === current);
  const accepted = remaining === '' && finalState.isFinal && !stuck;

  let msg;
  if (accepted) {
    msg = output ? `✓ Cadena aceptada · Salida: ${output}` : '✓ Cadena aceptada';
  } else if (stuck && remaining === '') {
    msg = `✗ Sin transición aplicable. Estado ${finalState.label}, tope ${top() || '∅'}`;
  } else if (stuck) {
    msg = `✗ Sin transición para "${remaining[0]}" con tope ${top() || '∅'}`;
  } else {
    msg = `✗ Terminó en ${finalState.label} (no final) o entrada no consumida`;
  }

  return { result: accepted ? 'accepted' : 'rejected', msg, trace };
}

// Primer conflicto de no determinismo del APD (ver findConflict): { msg, states } o null.
export function apdConflict({ states, transitions }) {
  const label = id => states.find(s => s.id === id)?.label ?? '?';
  for (const [i, t] of transitions.entries()) {
    const u = findConflict(transitions.slice(i + 1), t.from, t.symbol, t.stackTop);
    if (u) return { msg: `desde ${label(t.from)} con tope ${t.stackTop} hay dos transiciones posibles: "${apdLabel(t)}" y "${apdLabel(u)}"`, states: [t.from] };
  }
  return null;
}

// Detecta violaciones de determinismo: misma (estado, tope) con igual entrada,
// o mezclando ε con cualquier entrada. ε se guarda como symbol ''.
export function findConflict(transitions, from, input, stackTop) {
  return transitions.find(t =>
    t.from === from && t.stackTop === stackTop &&
    (t.symbol === '' || input === '' || t.symbol === input)
  );
}

// Etiqueta "a, A/AA" (+ ", salida") usada en el lienzo, la lista y los toasts.
export function apdLabel(t) {
  const inS = t.isEpsilon ? 'ε' : t.symbol;
  const rep = t.stackReplace === '' ? 'ε' : t.stackReplace;
  return `${inS}, ${t.stackTop}/${rep}`;
}
