// Modales para crear transiciones: símbolo simple (AFD) o con pila (APD).
import { findConflict } from '../engine/apd.js';

const $ = id => document.getElementById(id);

function symbolButton(label, className, onClick) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

// Resalta el botón `idx` de la grilla con un outline del color dado.
function highlight(gridId, idx, color) {
  const buttons = document.querySelectorAll(`#${gridId} .symbol-btn`);
  buttons.forEach(btn => { btn.style.outline = ''; });
  if (buttons[idx]) {
    buttons[idx].style.outline = `3px solid var(${color})`;
    buttons[idx].style.outlineOffset = '2px';
  }
}

export const modals = {
  openTransitionModal(from, to) {
    if (this.state.automatonType === 'afd') this.openSymbolModal(from, to);
    else this.openStackModal(from, to);
  },

  openSymbolModal(from, to) {
    const fromState = this.getState(from);
    const toState = this.getState(to);
    if (!fromState || !toState) return;

    const available = this.state.alphabet.filter(sym =>
      !this.state.transitions.some(t => t.from === from && t.symbol === sym && !t.isEpsilon)
    );
    if (available.length === 0) {
      this.showToast(`${fromState.label} ya tiene transiciones para todo el alfabeto`, 'error');
      return;
    }

    $('modalFrom').textContent = fromState.label;
    $('modalTo').textContent = toState.label;
    $('symbolGrid').replaceChildren(...available.map(sym =>
      symbolButton(sym, 'symbol-btn', () => {
        this.addTransition(from, to, { symbol: sym });
        this.closeSymbolModal();
      })
    ));
    $('symbolModal').classList.add('show');
  },

  closeSymbolModal() {
    $('symbolModal').classList.remove('show');
  },

  openStackModal(from, to) {
    const fromState = this.getState(from);
    const toState = this.getState(to);
    if (!fromState || !toState) return;

    if (this.state.stackAlphabet.length === 0) {
      this.showToast('Define el alfabeto de pila primero', 'error');
      return;
    }

    this.state.stackModal = { from, to, input: null, stackTop: null };

    $('stackModalFrom').textContent = fromState.label;
    $('stackModalTo').textContent = toState.label;
    $('stackReplaceInput').value = '';
    $('outputInput').value = '';

    const existing = this.state.transitions.filter(t => t.from === from && t.to === to).length;
    const info = $('multiEdgeInfo');
    info.style.display = existing > 0 ? 'block' : 'none';
    if (existing > 0) {
      info.textContent = `Ya hay ${existing} transición(es) entre ${fromState.label} y ${toState.label}. Puedes agregar más.`;
    }

    const eps = symbolButton('ε', 'symbol-btn epsilon', () => this.selectStackInput(''));
    eps.title = 'Transición sin consumir entrada';
    $('inputSymbolGrid').replaceChildren(eps, ...this.state.alphabet.map(sym =>
      symbolButton(sym, 'symbol-btn', () => this.selectStackInput(sym))
    ));
    $('stackTopGrid').replaceChildren(...this.state.stackAlphabet.map(sym =>
      symbolButton(sym, 'symbol-btn stack-btn', () => this.selectStackTop(sym))
    ));

    $('stackModal').classList.add('show');
  },

  selectStackInput(sym) {
    this.state.stackModal.input = sym;
    // El botón ε ocupa el índice 0
    highlight('inputSymbolGrid', sym === '' ? 0 : this.state.alphabet.indexOf(sym) + 1, '--accent');
  },

  selectStackTop(sym) {
    this.state.stackModal.stackTop = sym;
    highlight('stackTopGrid', this.state.stackAlphabet.indexOf(sym), '--stack');
  },

  closeStackModal() {
    $('stackModal').classList.remove('show');
  },

  confirmStackTransition() {
    const { from, to, input, stackTop } = this.state.stackModal;

    if (input === null) return this.showToast('Selecciona el símbolo de entrada (o ε)', 'error');
    if (!stackTop) return this.showToast('Selecciona el tope de pila', 'error');

    let replace = $('stackReplaceInput').value.trim();
    if (replace === 'ε') replace = '';

    const invalid = replace.split('').filter(c => c !== ' ' && !this.state.stackAlphabet.includes(c));
    if (invalid.length > 0) {
      return this.showToast(`Símbolos inválidos en reemplazo: ${invalid.join(', ')}`, 'error');
    }

    if (findConflict(this.state.transitions, from, input, stackTop)) {
      const label = this.getState(from).label;
      return this.showToast(`Conflicto de determinismo: ya existe δ(${label}, ${input || 'ε'}, ${stackTop})`, 'error');
    }

    const output = $('outputInput').value.trim();
    this.addTransition(from, to, {
      symbol: input, isEpsilon: input === '',
      stackTop, stackReplace: replace, output: output || null
    });
    this.closeStackModal();
  }
};
