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
