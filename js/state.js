// Estado global de la app. Un único objeto mutable: los módulos de ui/ lo leen
// vía `this.state` y llaman a `this.render()` después de modificarlo.

export function createState() {
  return {
    automatonType: 'afd', // 'afd' | 'apd'
    alphabet: ['0', '1'],
    stackAlphabet: ['A', 'Z'],
    initialStackSymbol: 'Z',
    states: [],      // { id, x, y, label, isStart, isFinal }
    transitions: [], // { id, from, to, symbol, [isEpsilon, stackTop, stackReplace, output] }
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
    // Cámara (Pan & Zoom)
    camera: { x: 0, y: 0, scale: 1 },
    panning: false,
    panStart: { x: 0, y: 0 },
    panCamStart: { x: 0, y: 0 }
  };
}

export const STATE_RADIUS = 28;
