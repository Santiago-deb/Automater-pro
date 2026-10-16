// Panel lateral: listas de estados/transiciones, resultado de la prueba,
// traza, pila visual, toasts y hint del lienzo.
import { AUTOMATA } from '../engine/automata.js';
import { typeClass } from '../state.js';
import { isDeterministic } from '../engine/af.js';
import { callText } from '../engine/mt.js';

const $ = id => document.getElementById(id);

const ICONS = {
  start: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  final: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/></svg>',
  trash: size => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"/></svg>`
};

const HINTS = {
  select: 'Arrastra para mover · arrastra en vacío o Shift + clic para elegir varios · doble clic: opciones',
  add: 'Clic en el lienzo para agregar · arrastra un estado para moverlo · doble clic: opciones',
  connect: 'Clic en origen y luego en destino (mismo estado = bucle) · arrastra para mover · Shift + clic elige varios',
  delete: 'Clic en estado o transición para eliminarlo'
};

// Crea un elemento HTML. `text` siempre va como textContent (nunca HTML).
function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function iconButton(className, title, svg, onClick) {
  const btn = el('button', className);
  btn.title = title;
  btn.innerHTML = svg;
  btn.addEventListener('click', onClick);
  return btn;
}

export const panel = {
  render() {
    this.renderStateList();
    this.renderTransList();
    this.renderModules();
    this.renderCanvas();
    $('canvasHint').classList.toggle('hidden', this.state.states.length > 0);
    $('stateCount').textContent = this.state.states.length;
    $('transCount').textContent = this.state.transitions.length;
    // En modo AF se avisa si el autómata quedó no determinístico
    const badge = $('ndBadge');
    const isAF = this.state.automatonType === 'afd' && this.state.transitions.length > 0;
    const det = isDeterministic(this.state.transitions);
    badge.hidden = !isAF;
    badge.textContent = det ? 'AFD' : 'AFND';
    badge.classList.toggle('nd', !det);
    badge.title = det ? 'Determinístico: δ es función' : 'No determinístico: algún estado tiene dos destinos con el mismo símbolo';
    this.scheduleSave();
  },

  updateHint() {
    $('hintText').textContent = this.state.states.length === 0
      ? 'Selecciona "Agregar estado" y haz clic en el lienzo'
      : HINTS[this.state.mode];
  },

  // `action` = { label, run } agrega un botón (p. ej. Deshacer) y deja el toast más tiempo.
  showToast(msg, type = '', action = null) {
    const t = $('toast');
    t.textContent = msg;
    t.className = `toast show ${type}${action ? ' has-action' : ''}`;
    if (action) {
      const btn = el('button', 'toast-action', action.label);
      btn.addEventListener('click', () => { t.classList.remove('show'); action.run(); });
      t.appendChild(btn);
    }
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), action ? 6000 : 2800);
  },

  showTestResult(type, msg) {
    const r = $('testResult');
    r.textContent = msg;
    r.className = `test-result show ${type}`;
  },

  clearTestOutput() {
    $('testResult').classList.remove('show');
    $('testTrace').innerHTML = '';
    $('stackVisualWrap').innerHTML = '';
  },

  renderStateList() {
    const list = $('statesList');
    if (this.state.states.length === 0) {
      list.innerHTML = '<p class="empty">Sin estados todavía</p>';
      return;
    }
    list.innerHTML = '';
    this.state.states.forEach(s => {
      const item = el('div', 'state-item');
      item.appendChild(el('div', 'badge', s.label));

      const tags = el('div', 'tags');
      if (s.isStart) tags.appendChild(el('span', 'tag start', 'Inicio'));
      if (s.isFinal) tags.appendChild(el('span', 'tag final', 'Final'));
      item.appendChild(tags);

      const actions = el('div', 'state-actions');
      actions.append(
        iconButton('icon-btn' + (s.isStart ? ' active' : ''), 'Marcar como inicial', ICONS.start, () => this.setStart(s.id)),
        iconButton('icon-btn' + (s.isFinal ? ' active final-btn' : ''), 'Alternar final', ICONS.final, () => this.toggleFinal(s.id)),
        iconButton('icon-btn', 'Eliminar', ICONS.trash(13), () => this.deleteState(s.id))
      );
      item.appendChild(actions);
      list.appendChild(item);
    });
  },

  renderTransList() {
    const list = $('transList');
    if (this.state.transitions.length === 0) {
      list.innerHTML = '<p class="empty">Sin transiciones todavía</p>';
      return;
    }
    list.innerHTML = '';
    this.state.transitions.forEach(t => {
      const from = this.getState(t.from);
      const to = this.getState(t.to);
      if (!from || !to) return;

      const row = el('div', 'trans-row');
      const toText = t.call ? callText(t, id => this.getState(id)?.label ?? '?') : to.label;
      row.append(el('span', 'trans-from', from.label), el('span', 'trans-arrow', '→'), el('span', 'trans-to', toText));

      const type = this.state.automatonType;
      const detail = el('span', 'trans-detail', AUTOMATA[type].label(t));
      if (type === 'afd') {
        Object.assign(detail.style, { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent)' });
      } else if (type === 'mt') {
        Object.assign(detail.style, { background: 'var(--tape-soft)', color: 'var(--tape)', borderColor: 'var(--tape)' });
      }
      row.appendChild(detail);
      if (t.output) row.appendChild(el('span', 'trans-output', `→ ${t.output}`));

      row.appendChild(iconButton('trans-delete', 'Eliminar transición', ICONS.trash(12), () => this.deleteTransition(t.id)));

      const item = el('div', 'trans-item');
      item.appendChild(row);
      list.appendChild(item);
    });
  },

  // MT compuesta: alias → archivo, si está cargado, y para elegir el archivo.
  renderModules() {
    const list = $('moduleList');
    const mods = Object.entries(this.state.modules ?? {});
    list.hidden = !mods.length;
    if (!mods.length) return list.replaceChildren();
    const NAME = { afd: 'AF', apd: 'AP', mt: 'MT' };
    list.replaceChildren(el('h4', 'module-title', 'Sub-máquinas (@alias)'), ...mods.map(([alias, m]) => {
      const a = m.automaton;
      const row = el('div', 'module-row');
      row.append(
        el('span', 'module-alias', `@${alias}`),
        el('span', 'module-file', m.file),
        el('span', `module-status${a ? '' : ' missing'}`, a ? `✓ ${NAME[a.type]}${a.type === 'mt' ? ` de ${a.tapeCount} cinta${a.tapeCount > 1 ? 's' : ''}` : ''}` : '✗ falta'));
      const btn = el('button', 'btn module-load', a ? 'Cambiar' : 'Elegir archivo');
      btn.addEventListener('click', () => this.loadModules(a ? alias : null));
      row.appendChild(btn);
      return row;
    }));
  },

  // Traza "q0 q1 1 q0 1 ..." con el paso actual resaltado.
  renderTrace(trace, currentIdx) {
    const isAPD = this.state.automatonType === 'apd';
    const theme = typeClass(this.state.automatonType);
    const cls = theme ? ` ${theme}` : '';
    const wrap = $('testTrace');
    wrap.innerHTML = '';
    trace.forEach((t, i) => {
      // AFND: el paso es un conjunto de estados
      const text = Array.isArray(t.state)
        ? `{${t.state.map(id => this.getState(id)?.label ?? '?').join(', ')}}`
        : this.getState(t.state)?.label ?? '?';
      const stEl = el('span', 'trace-state' + cls + (i === currentIdx ? ' current' : ''), text);
      wrap.appendChild(stEl);

      if (t.symbol) {
        wrap.appendChild(el('span', 'trace-symbol' + cls, t.symbol));
      } else if (isAPD && i < trace.length - 1) {
        const eps = el('span', 'trace-symbol apd', 'ε');
        eps.style.opacity = '0.6';
        wrap.appendChild(eps);
      }
    });
  },

  renderStackVisual({ stack, remaining, output }) {
    const wrap = $('stackVisualWrap');
    wrap.innerHTML = '';
    if (this.state.automatonType !== 'apd') return;

    const configRow = (label, value, valueClass, marginTop) => {
      const row = el('div', 'config-row');
      row.style.marginTop = marginTop;
      row.appendChild(el('span', 'config-label', label));
      if (value !== undefined) row.appendChild(el('span', `config-value ${valueClass}`, value));
      return row;
    };

    const container = el('div');
    container.appendChild(configRow('Entrada restante:', remaining || 'ε', 'accent', '8px'));
    if (output) container.appendChild(configRow('Salida:', output, 'warning', '6px'));
    container.appendChild(configRow('Pila:', undefined, '', '6px'));

    const stackEl = el('div', 'stack-visual');
    if (stack.length === 0) {
      stackEl.appendChild(el('div', 'empty', 'pila vacía'));
    } else {
      stack.forEach((sym, idx) => {
        const cell = el('div', 'stack-cell', sym);
        if (sym === this.state.initialStackSymbol) cell.classList.add('z0');
        if (idx === stack.length - 1) cell.classList.add('top');
        stackEl.appendChild(cell);
      });
    }
    container.appendChild(stackEl);
    wrap.appendChild(container);
  }
};
