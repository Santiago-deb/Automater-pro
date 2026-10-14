// Modales para crear transiciones: símbolo simple (AFD), con pila (APD) o con cintas (MT).
import { findConflict } from '../engine/apd.js';
import { findConflictMT, tapeSymbols, MOVES, BLANK } from '../engine/mt.js';

const $ = id => document.getElementById(id);

function select(options, value) {
  const sel = document.createElement('select');
  sel.className = 'input mono tape-focus';
  sel.append(...options.map(o => new Option(o, o)));
  sel.value = value;
  return sel;
}

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
    const type = this.state.automatonType;
    if (type === 'afd') this.openSymbolModal(from, to);
    else if (type === 'apd') this.openStackModal(from, to);
    else this.openTapeModal(from, to);
  },

  openSymbolModal(from, to) {
    const fromState = this.getState(from);
    const toState = this.getState(to);
    if (!fromState || !toState) return;

    // Solo se excluyen los símbolos que ya van de `from` a `to`. Si un símbolo ya
    // sale de `from` hacia otro estado, usarlo vuelve al autómata no determinístico.
    const available = this.state.alphabet.filter(sym =>
      !this.state.transitions.some(t => t.from === from && t.to === to && t.symbol === sym)
    );
    if (available.length === 0) {
      this.showToast(`Ya hay transiciones de ${fromState.label} a ${toState.label} con todo el alfabeto`, 'error');
      return;
    }
    const usedElsewhere = sym => this.state.transitions.some(t => t.from === from && t.symbol === sym);

    $('modalFrom').textContent = fromState.label;
    $('modalTo').textContent = toState.label;
    $('symbolGrid').replaceChildren(...available.map(sym => {
      const nd = usedElsewhere(sym);
      const btn = symbolButton(sym, 'symbol-btn' + (nd ? ' nd' : ''), () => {
        this.addTransition(from, to, { symbol: sym });
        this.closeSymbolModal();
        if (nd) this.showToast(`Ahora es un AFND: δ(${fromState.label}, ${sym}) tiene más de un destino`, 'success');
      });
      if (nd) btn.title = `δ(${fromState.label}, ${sym}) ya está definida: usarlo lo vuelve no determinístico (AFND)`;
      return btn;
    }));
    $('symbolModalHint').hidden = !available.some(usedElsewhere);
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
  },

  // Una fila por cinta: "C1  [lee] → [escribe] [mov]". Al elegir qué se lee,
  // lo escrito copia ese símbolo hasta que se lo cambie a mano.
  openTapeModal(from, to) {
    const fromState = this.getState(from);
    const toState = this.getState(to);
    if (!fromState || !toState) return;

    this.state.tapeModal = { from, to };
    $('tapeModalFrom').textContent = fromState.label;
    $('tapeModalTo').textContent = toState.label;

    const symbols = tapeSymbols(this.state);
    const rows = Array.from({ length: this.state.tapeCount }, (_, i) => {
      const first = i === 0 ? symbols[0] : BLANK;
      const read = select(symbols, first);
      const write = select(symbols, first);
      const move = select(MOVES, 'D');
      read.dataset.role = 'read';
      write.dataset.role = 'write';
      move.dataset.role = 'move';
      read.addEventListener('change', () => { if (!write.dataset.touched) write.value = read.value; });
      write.addEventListener('change', () => { write.dataset.touched = '1'; });

      const row = document.createElement('div');
      row.className = 'tape-rule';
      const arrow = document.createElement('span');
      arrow.textContent = '→';
      const name = document.createElement('span');
      name.textContent = `C${i + 1}`;
      row.append(name, read, arrow, write, move);
      return row;
    });
    $('tapeRules').replaceChildren(...rows);
    $('tapeModal').classList.add('show');
  },

  closeTapeModal() {
    $('tapeModal').classList.remove('show');
  },

  confirmTapeTransition() {
    const { from, to } = this.state.tapeModal;
    const values = role => [...document.querySelectorAll(`#tapeRules [data-role=${role}]`)].map(s => s.value);
    const reads = values('read');

    if (findConflictMT(this.state.transitions, from, reads)) {
      const label = this.getState(from).label;
      return this.showToast(`No determinista: ya existe δ(${label}, ${reads.join(', ')})`, 'error');
    }

    this.addTransition(from, to, { reads, writes: values('write'), moves: values('move') });
    this.closeTapeModal();
  }
};
