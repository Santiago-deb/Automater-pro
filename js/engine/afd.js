// Simulación de AFD. Pura: no toca el DOM, se puede testear con node.
// Devuelve { result: 'accepted'|'rejected'|'warning', msg, trace }.
// trace = [{ state, symbol, transitionId? }]; vacío si no hay nada que animar.

export function simulateAFD({ states, transitions, alphabet }, input) {
  const startState = states.find(s => s.isStart);
  const label = id => states.find(s => s.id === id).label;

  if (!startState) return { result: 'warning', msg: '⚠ Define un estado inicial', trace: [] };
  if (alphabet.length === 0) return { result: 'warning', msg: '⚠ Define el alfabeto primero', trace: [] };

  for (const ch of input) {
    if (!alphabet.includes(ch)) {
      return { result: 'rejected', msg: `✗ "${ch}" no pertenece al alfabeto`, trace: [], highlight: startState.id };
    }
  }

  let current = startState.id;
  const trace = [{ state: current, symbol: null }];

  for (const ch of input) {
    const trans = transitions.find(t => t.from === current && t.symbol === ch);
    if (!trans) {
      return { result: 'rejected', msg: `✗ No hay transición δ(${label(current)}, ${ch})`, trace };
    }
    current = trans.to;
    trace.push({ state: current, symbol: ch, transitionId: trans.id });
  }

  const finalState = states.find(s => s.id === current);
  return finalState.isFinal
    ? { result: 'accepted', msg: '✓ Cadena aceptada', trace }
    : { result: 'rejected', msg: `✗ Terminó en ${finalState.label}, que no es final`, trace };
}
