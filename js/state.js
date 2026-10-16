// Estado global de la app. Un único objeto mutable: los módulos de ui/ lo leen
// vía `this.state` y llaman a `this.render()` después de modificarlo.

export function createState() {
  return {
    automatonType: 'afd', // 'afd' | 'apd' | 'mt' (claves de engine/automata.js)
    alphabet: ['0', '1'],
    stackAlphabet: ['A', 'Z'],
    initialStackSymbol: 'Z',
    tapeAlphabet: ['X', 'A'], // auxiliares de la MT
    tapeCount: 2,
    states: [],      // { id, x, y, label, isStart, isFinal }
    // AFD/APD: { id, from, to, symbol, [isEpsilon, stackTop, stackReplace, output] }
    // MT:      { id, from, to, reads: [], writes: [], moves: [] } (uno por cinta)
    // MT: una transición puede llevar call: { alias, reject, none, tapes } (sub-máquina)
    transitions: [],
    modules: {},     // MT: alias → { file, automaton } (sub-máquinas de MTSolution)
    selectedState: null,
    connectFrom: null,
    mode: 'select',  // 'select' | 'add' | 'connect' | 'delete'
    nextId: 1,
    nextTransId: 1,
    currentTestState: null,
    activeTransition: null,
    pendingDrag: null,
    suppressClick: false,
    testing: false,
    stackModal: { from: null, to: null, input: null, stackTop: null },
    tapeModal: { from: null, to: null },
    // Cámara (Pan & Zoom)
    camera: { x: 0, y: 0, scale: 1 },
    panning: false,
    panStart: { x: 0, y: 0 },
    panCamStart: { x: 0, y: 0 }
  };
}

export const STATE_RADIUS = 28;

// Clase CSS del color de cada tipo (ver base.css); el AFD usa el acento por defecto.
export const typeClass = type => (type === 'afd' ? '' : type);
