// Acciones que modifican el autómata y orquestan la verificación.
import { simulateAFD } from './engine/afd.js';
import { simulateAPD } from './engine/apd.js';
import { exampleAFD, exampleAPD } from './engine/examples.js';

const $ = id => document.getElementById(id);
const STEP_DELAY = { afd: 500, apd: 700 }; // ms por paso de la animación

export const actions = {
  getState(id) {
    return this.state.states.find(s => s.id === id);
  },

  switchType(type) {
    if (this.state.automatonType === type) return;
    this.state.automatonType = type;
    const isAPD = type === 'apd';
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
      btn.classList.toggle('apd', isAPD && btn.dataset.type === 'apd');
    });
    $('stackSection').style.display = isAPD ? 'block' : 'none';
    document.querySelectorAll('.tool-btn.active').forEach(btn => btn.classList.toggle('apd', isAPD));
    $('hintPulse').classList.toggle('apd', isAPD);
    this.loadExample();
  },

  setMode(mode) {
    this.state.mode = mode;
    this.state.connectFrom = null;
    this.state.selectedState = null;
    document.querySelectorAll('.tool-btn').forEach(btn => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('apd', isActive && this.state.automatonType === 'apd');
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
    this.state.transitions = this.state.transitions.filter(t => t.from !== id && t.to !== id);
    if (this.state.selectedState === id) this.state.selectedState = null;
    if (this.state.connectFrom === id) this.state.connectFrom = null;
    this.updateHint();
    this.render();
    if (st) this.showToast(`Estado ${st.label} eliminado`);
  },

  setStart(id) {
    this.state.states.forEach(s => { s.isStart = s.id === id; });
    this.render();
    const st = this.getState(id);
    if (st) this.showToast(`${st.label} es ahora el estado inicial`, 'success');
  },

  toggleFinal(id) {
    const st = this.getState(id);
    if (st) { st.isFinal = !st.isFinal; this.render(); }
  },

  addTransition(from, to, data) {
    this.state.transitions.push({ id: this.state.nextTransId++, from, to, ...data });
    this.render();
    const fromLabel = this.getState(from).label;
    const toLabel = this.getState(to).label;
    if (this.state.automatonType === 'afd') {
      this.showToast(`δ(${fromLabel}, ${data.symbol}) = ${toLabel}`, 'success');
    } else {
      const inS = data.isEpsilon ? 'ε' : data.symbol;
      const rep = data.stackReplace === '' ? 'ε' : data.stackReplace;
      this.showToast(`δ(${fromLabel}, ${inS}, ${data.stackTop}) = (${toLabel}, ${rep})`, 'stack');
    }
  },

  deleteTransition(id) {
    this.state.transitions = this.state.transitions.filter(t => t.id !== id);
    this.render();
    this.showToast('Transición eliminada');
  },

  verifyString() {
    if (this.state.testing) return;
    const type = this.state.automatonType;
    const simulate = type === 'afd' ? simulateAFD : simulateAPD;
    const { result, msg, trace, highlight } = simulate(this.state, $('testString').value);

    if (trace.length === 0) {
      this.showTestResult(result, msg);
      if (highlight) {
        this.state.currentTestState = highlight;
        this.renderCanvas();
      }
      return;
    }
    this.animateTrace(trace, result, msg, STEP_DELAY[type]);
  },

  animateTrace(trace, result, msg, delay) {
    const isAPD = this.state.automatonType === 'apd';
    this.state.testing = true;
    this.state.currentTestState = null;
    this.state.activeTransition = null;
    $('testResult').classList.remove('show');
    if (!isAPD) $('stackVisualWrap').innerHTML = '';

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
      if (isAPD) this.renderStackVisual(t);
      this.renderCanvas();
      i++;
      setTimeout(step, delay);
    };
    step();
  },

  // Vacía el autómata y la salida de la prueba (común a "Limpiar" y "Ejemplo").
  resetAutomaton() {
    Object.assign(this.state, {
      states: [], transitions: [], nextId: 1, nextTransId: 1,
      currentTestState: null, activeTransition: null
    });
    this.clearTestOutput();
  },

  clearAll() {
    this.resetAutomaton();
    this.state.selectedState = null;
    this.state.connectFrom = null;
    $('testString').value = '';
    this.updateHint();
    this.render();
    this.showToast('Lienzo limpiado', 'success');
  },

  loadExample() {
    this.resetAutomaton();

    const rect = this.svg.getBoundingClientRect();
    const isAPD = this.state.automatonType === 'apd';
    const ex = isAPD
      ? exampleAPD(rect.width / 2, rect.height / 2, rect.width, rect.height)
      : exampleAFD(rect.width / 2, rect.height / 2, rect.width);

    this.state.states = ex.states;
    this.state.transitions = ex.transitions;
    this.state.nextId = ex.states.length + 1;
    this.state.nextTransId = ex.transitions.length + 1;
    this.state.alphabet = ex.alphabet;
    $('alphabetInput').value = ex.alphabet.join(', ');
    if (isAPD) {
      this.state.stackAlphabet = ex.stackAlphabet;
      this.state.initialStackSymbol = ex.initialStackSymbol;
      $('stackAlphabetInput').value = ex.stackAlphabet.join(', ');
      $('initialStackInput').value = ex.initialStackSymbol;
    }
    $('testString').value = ex.testString;
    this.showToast(ex.toast, isAPD ? 'stack' : 'success');

    this.updateHint();
    this.render();
    this.fitToView();
  }
};
