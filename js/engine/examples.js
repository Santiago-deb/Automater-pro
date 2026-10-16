// Autómatas de ejemplo, centrados en (cx, cy) y escalados al tamaño del lienzo.

export function exampleAFD(cx, cy, width) {
  const offset = Math.min(140, width * 0.22);
  return {
    toast: 'Ejemplo: AFD con número par de 1s',
    testString: '110011',
    alphabet: ['0', '1'],
    states: [
      { id: 1, x: cx - offset, y: cy, label: 'q0', isStart: true, isFinal: true },
      { id: 2, x: cx + offset, y: cy, label: 'q1', isStart: false, isFinal: false }
    ],
    transitions: [
      { id: 1, from: 1, to: 1, symbol: '0' },
      { id: 2, from: 2, to: 2, symbol: '0' },
      { id: 3, from: 1, to: 2, symbol: '1' },
      { id: 4, from: 2, to: 1, symbol: '1' }
    ]
  };
}

export function exampleAPD(cx, cy, width, height) {
  const ox = Math.min(160, width * 0.22);
  const oy = Math.min(80, height * 0.18);
  const t = (id, from, to, symbol, stackTop, stackReplace) =>
    ({ id, from, to, symbol, isEpsilon: symbol === '', stackTop, stackReplace, output: null });
  return {
    toast: 'Ejemplo: APD que reconoce aⁿbⁿ con n > 0',
    testString: 'aabb',
    alphabet: ['a', 'b'],
    stackAlphabet: ['A', 'Z'],
    initialStackSymbol: 'Z',
    states: [
      { id: 1, x: cx - ox, y: cy - oy, label: 'q0', isStart: true, isFinal: false },
      { id: 2, x: cx, y: cy - oy, label: 'q1', isStart: false, isFinal: false },
      { id: 3, x: cx + ox, y: cy - oy, label: 'q2', isStart: false, isFinal: false },
      { id: 4, x: cx + ox, y: cy + oy, label: 'q3', isStart: false, isFinal: true }
    ],
    transitions: [
      t(1, 1, 2, 'a', 'Z', 'AZ'),
      t(2, 2, 2, 'a', 'A', 'AA'),
      t(3, 2, 3, 'b', 'A', ''),
      t(4, 3, 3, 'b', 'A', ''),
      t(5, 3, 4, '', 'Z', 'Z')
    ]
  };
}

// Ejemplo visto en clase: L = { aⁿ bⁿ c²ⁿ / n > 0 } con 2 cintas.
// Copia las a en C2 como A, retrocede una A por cada b, y avanza una A cada dos c.
export function exampleMT(cx, cy) {
  const dx = 190;
  const x0 = cx - 2 * dx;
  const t = (id, from, to, reads, writes, moves) => ({ id, from, to, reads, writes, moves });
  return {
    toast: 'Ejemplo: MT de 2 cintas que reconoce aⁿbⁿc²ⁿ con n > 0',
    testString: 'aabbcccc',
    alphabet: ['a', 'b', 'c'],
    tapeAlphabet: ['X', 'A'],
    tapeCount: 2,
    states: [
      { id: 1, x: x0, y: cy, label: 'q0', isStart: true, isFinal: false },
      { id: 2, x: x0 + dx, y: cy, label: 'q1', isStart: false, isFinal: false },
      { id: 3, x: x0 + 2 * dx, y: cy, label: 'q2', isStart: false, isFinal: false },
      { id: 4, x: x0 + 3 * dx, y: cy, label: 'q3', isStart: false, isFinal: false },
      { id: 5, x: x0 + 4 * dx, y: cy, label: 'q4', isStart: false, isFinal: false },
      { id: 6, x: x0 + 3 * dx, y: cy + dx * 0.8, label: 'q5', isStart: false, isFinal: true }
    ],
    transitions: [
      t(1, 1, 2, ['a', 'B'], ['a', 'X'], ['N', 'D']),
      t(2, 2, 2, ['a', 'B'], ['a', 'A'], ['D', 'D']),
      t(3, 2, 3, ['b', 'B'], ['b', 'B'], ['N', 'I']),
      t(4, 3, 3, ['b', 'A'], ['b', 'A'], ['D', 'I']),
      t(5, 3, 4, ['c', 'X'], ['c', 'X'], ['N', 'D']),
      t(6, 4, 5, ['c', 'A'], ['c', 'A'], ['D', 'N']),
      t(7, 5, 4, ['c', 'A'], ['c', 'A'], ['D', 'D']),
      t(8, 4, 6, ['B', 'B'], ['B', 'B'], ['N', 'N'])
    ]
  };
}
