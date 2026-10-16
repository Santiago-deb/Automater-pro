// Deshacer / rehacer (Ctrl+Z, Ctrl+Shift+Z y los botones de la barra).
// Guarda fotos del autómata (estados, transiciones, alfabetos, módulos) con un
// historial por tipo, así cambiar de AF a MT no mezcla los tableros.
// Las fotos se toman con el mismo temporizador del autoguardado: un arrastre o
// varias teclas seguidas en un alfabeto quedan como un solo paso.
import { FIELDS } from './files.js';

const $ = id => document.getElementById(id);
const LIMIT = 100;

export const history = {
  hist() {
    this._hist ??= {};
    return (this._hist[this.state.automatonType] ??= { past: [], future: [], current: null });
  },

  snapshot() {
    return JSON.stringify(Object.fromEntries(FIELDS.map(f => [f, this.state[f]])));
  },

  // Si el tablero cambió desde la última foto, la anterior pasa al pasado.
  commitHistory() {
    if (this._restoring) return;
    const h = this.hist();
    const now = this.snapshot();
    if (h.current === null) h.current = now;
    else if (now !== h.current) {
      h.past.push(h.current);
      if (h.past.length > LIMIT) h.past.shift();
      h.future = [];
      h.current = now;
    }
    this.updateHistoryButtons();
  },

  undo() { this.travel('past', 'future'); },
  redo() { this.travel('future', 'past'); },

  travel(from, to) {
    this.commitHistory(); // lo último que se hizo, aunque el temporizador no haya llegado
    const h = this.hist();
    if (!h[from].length) return;
    h[to].push(h.current);
    h.current = h[from].pop();
    this.closeStateMenu();
    this.state.connectFrom = null;
    this._restoring = true;
    this.applyAutomaton({ type: this.state.automatonType, ...JSON.parse(h.current) }, { fit: false });
    this._restoring = false;
    this.updateHistoryButtons();
  },

  canUndo() { return this.hist().past.length > 0; },

  updateHistoryButtons() {
    const h = this.hist();
    $('btnUndo').disabled = !h.past.length;
    $('btnRedo').disabled = !h.future.length;
  }
};
