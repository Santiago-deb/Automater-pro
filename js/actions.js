// Acciones que modifican el autómata y orquestan la verificación.
import { AUTOMATA } from './engine/automata.js';
import { mtDelta } from './engine/mt.js';
import { typeClass } from './state.js';

const $ = id => document.getElementById(id);
const THEMES = Object.keys(AUTOMATA).map(typeClass).filter(Boolean);
const TOAST_TYPE = { afd: 'success', apd: 'stack', mt: 'tape' };

// ms por paso de la animación. La MT puede dar cientos de pasos: se acelera con el largo.
// ponytail: heurística fija; agregar control de velocidad si hace falta
const stepDelay = (type, steps) =>
  ({ afd: 500, apd: 700 })[type] ?? Math.max(120, Math.min(600, 9000 / steps));

// Deja en `el` solo la clase de color del tipo actual (si `on`).
function setTheme(el, type, on = true) {
  el.classList.remove(...THEMES);
  if (on && typeClass(type)) el.classList.add(typeClass(type));
}

export const actions = {
  getState(id) {
    return this.state.states.find(s => s.id === id);
  },

  switchType(type) {
    if (this.state.automatonType === type) return;
    this.setTypeUI(type);
    this.restoreOrExample();
  },

  // Cambia el tipo activo y la interfaz, sin tocar el autómata.
  setTypeUI(type) {
    this.state.automatonType = type;
    setTheme(document.body, type);
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
      setTheme(btn, type, btn.dataset.type === type);
    });
    $('stackSection').style.display = type === 'apd' ? 'block' : 'none';
    $('tapeSection').style.display = type === 'mt' ? 'block' : 'none';
    document.querySelectorAll('.tool-btn.active').forEach(btn => setTheme(btn, type));
    setTheme($('hintPulse'), type);
    this.clearTestOutput();
  },

  setMode(mode) {
    this.state.mode = mode;
    this.state.connectFrom = null;
    if (mode === 'delete' || mode === 'connect') this.clearSelection();
    document.querySelectorAll('.tool-btn[data-mode]').forEach(btn => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle('active', isActive);
      setTheme(btn, this.state.automatonType, isActive);
    });
    this.svg.setAttribute('class', `mode-${mode}`);
    this.updateHint();
    this.render();
  },

  addState(x, y) {
    const id = this.state.nextId++;
    this.state.states.push({
      id, x, y, label: `q${id - 1}`, isStart: this.state.states.length === 0, isFinal: false
    });
    this.updateHint();
    this.render();
  },

  deleteState(id) {
    const st = this.getState(id);
    this.state.states = this.state.states.filter(s => s.id !== id);
    this.state.transitions = this.state.transitions.filter(t => t.from !== id && t.to !== id && t.call?.reject !== id);
    this.state.transitions.forEach(t => { if (t.call?.none === id) t.call.none = null; });
    this.pruneSelection();
    if (this.state.connectFrom === id) this.state.connectFrom = null;
    this.updateHint();
    this.render();
    if (st) this.showToast(`Estado ${st.label} eliminado`);
  },

  // Borra de una vez lo seleccionado (tecla Supr): un solo paso para deshacer.
  deleteSelection() {
    const { states, transitions } = this.state.selection;
    if (!states.length && !transitions.length) return;
    this.state.states = this.state.states.filter(s => !states.includes(s.id));
    this.state.transitions = this.state.transitions.filter(t =>
      !transitions.includes(t.id) && !states.includes(t.from) && !states.includes(t.to) && !states.includes(t.call?.reject));
    this.state.transitions.forEach(t => { if (states.includes(t.call?.none)) t.call.none = null; });
    if (states.includes(this.state.connectFrom)) this.state.connectFrom = null;
    this.clearSelection();
    this.updateHint();
    this.render();
    const n = states.length + transitions.length;
    this.showToast(n > 1 ? `Se eliminaron ${n} elementos` : 'Elemento eliminado');
  },

  renameState(id, name) {
    const st = this.getState(id);
    name = name.trim();
    if (!st || name === st.label) return true;
    if (!name) { this.showToast('El nombre no puede quedar vacío', 'error'); return false; }
    if (/[\s,(){}]/.test(name)) { this.showToast('El nombre no puede tener espacios, comas, paréntesis ni llaves', 'error'); return false; }
    if (this.state.states.some(s => s.label === name)) { this.showToast(`Ya hay un estado llamado ${name}`, 'error'); return false; }
    this.showToast(`${st.label} ahora se llama ${name}`, 'success');
    st.label = name;
    this.render();
    return true;
  },

  setStart(id) {
    this.state.states.forEach(s => { s.isStart = s.id === id; });
    this.render();
    const st = this.getState(id);
    if (st) this.showToast(`${st.label} es ahora el estado inicial`, 'success');
  },

  toggleFinal(id) {
    const st = this.getState(id);
    if (st) {
      st.isFinal = !st.isFinal;
      this.render();
      this.showToast(`${st.label} ${st.isFinal ? 'ahora es final' : 'ya no es final'}`, 'success');
    }
  },

  addTransition(from, to, data) {
    this.state.transitions.push({ id: this.state.nextTransId++, from, to, ...data });
    this.render();
    const fromLabel = this.getState(from).label;
    const toLabel = this.getState(to).label;
    const type = this.state.automatonType;
    if (type === 'afd') {
      this.showToast(`δ(${fromLabel}, ${data.symbol}) = ${toLabel}`, 'success');
    } else if (type === 'mt') {
      this.showToast(mtDelta(data, fromLabel, toLabel), 'tape');
    } else {
      const inS = data.isEpsilon ? 'ε' : data.symbol;
      const rep = data.stackReplace === '' ? 'ε' : data.stackReplace;
      this.showToast(`δ(${fromLabel}, ${inS}, ${data.stackTop}) = (${toLabel}, ${rep})`, 'stack');
    }
  },

  // Cambiar k invalida las transiciones de MT con otra cantidad de cintas.
  setTapeCount(k) {
    k = Math.max(1, Math.min(4, k || 1));
    $('tapeCountInput').value = k;
    if (k === this.state.tapeCount) return;
    this.state.tapeCount = k;
    const before = this.state.transitions.length;
    this.state.transitions = this.state.transitions.filter(t => !t.reads || t.reads.length === k);
    this.clearTestOutput();
    this.render();
    if (this.state.transitions.length < before) {
      this.showToast(`Se borraron ${before - this.state.transitions.length} transición(es) hechas para otra cantidad de cintas`, 'tape');
    }
  },

  deleteTransition(ids) {
    ids = [].concat(ids);
    this.state.transitions = this.state.transitions.filter(t => !ids.includes(t.id));
    this.pruneSelection();
    this.render();
    this.showToast(ids.length > 1 ? `${ids.length} transiciones eliminadas` : 'Transición eliminada');
  },

  verifyString() {
    if (this.state.testing) return;
    const type = this.state.automatonType;
    const { result, msg, trace, highlight } = AUTOMATA[type].simulate(this.state, $('testString').value);

    if (trace.length === 0) {
      this.showTestResult(result, msg);
      if (highlight) {
        this.state.currentTestState = highlight;
        this.renderCanvas();
      }
      return;
    }
    this.animateTrace(trace, result, msg, stepDelay(type, trace.length));
  },

  animateTrace(trace, result, msg, delay) {
    const type = this.state.automatonType;
    this.state.testing = true;
    this.state.currentTestState = null;
    this.state.activeTransition = null;
    $('testResult').classList.remove('show');
    if (type !== 'apd') $('stackVisualWrap').innerHTML = '';

    let i = 0;
    const step = () => {
      if (i >= trace.length) {
        this.showTestResult(result, msg);
        this.state.testing = false;
        return;
      }
      const t = trace[i];
      this.state.currentTestState = t.state;
      if (t.transitionId) this.state.activeTransition = t.transitionId;
      this.renderTrace(trace, i);
      if (type === 'apd') this.renderStackVisual(t);
      if (type === 'mt') this.renderTapeVisual(t, trace[i - 1]);
      this.renderCanvas();
      i++;
      setTimeout(step, delay);
    };
    step();
  },

  // Vacía el autómata y la salida de la prueba (común a "Limpiar" y "Ejemplo").
  resetAutomaton() {
    Object.assign(this.state, {
      states: [], transitions: [], modules: {}, nextId: 1, nextTransId: 1,
      currentTestState: null, activeTransition: null
    });
    this.clearTestOutput();
  },

  clearAll() {
    this.remember();
    this.resetAutomaton();
    this.clearSelection();
    this.state.connectFrom = null;
    $('testString').value = '';
    this.updateHint();
    this.render();
    this.toastWithUndo('Lienzo limpiado');
  },

  loadExample() {
    this.resetAutomaton();

    const rect = this.svg.getBoundingClientRect();
    const type = this.state.automatonType;
    const ex = AUTOMATA[type].example(rect.width / 2, rect.height / 2, rect.width, rect.height);

    this.state.states = ex.states;
    this.state.transitions = ex.transitions;
    this.state.nextId = ex.states.length + 1;
    this.state.nextTransId = ex.transitions.length + 1;
    this.state.alphabet = ex.alphabet;
    $('alphabetInput').value = ex.alphabet.join(', ');
    if (ex.stackAlphabet) {
      this.state.stackAlphabet = ex.stackAlphabet;
      this.state.initialStackSymbol = ex.initialStackSymbol;
      $('stackAlphabetInput').value = ex.stackAlphabet.join(', ');
      $('initialStackInput').value = ex.initialStackSymbol;
    }
    if (ex.tapeAlphabet) {
      this.state.tapeAlphabet = ex.tapeAlphabet;
      this.state.tapeCount = ex.tapeCount;
      $('tapeAlphabetInput').value = ex.tapeAlphabet.join(', ');
      $('tapeCountInput').value = ex.tapeCount;
    }
    $('testString').value = ex.testString;
    this.showToast(ex.toast, TOAST_TYPE[type]);

    this.updateHint();
    this.render();
    this.fitToView();
  }
};
