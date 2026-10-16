// Dibujo del autómata en el SVG (estados y aristas).
import { STATE_RADIUS as r, typeClass } from '../state.js';
import { AUTOMATA } from '../engine/automata.js';
import { callLabel } from '../engine/mt.js';

const NS = 'http://www.w3.org/2000/svg';
const MARKER_SUFFIX = { afd: '', apd: '-stack', mt: '-tape' }; // ids de <marker> en index.html

// currentTestState / activeTransition pueden ser un id o una lista (AFND)
const has = (value, id) => (Array.isArray(value) ? value.includes(id) : value === id);

// En el AF, las transiciones entre el mismo par de estados van en una sola
// arista rotulada "a, b" (así se dibuja en la cursada).
function groupEdges(transitions) {
  const groups = new Map();
  for (const t of transitions) {
    const key = `${t.from}>${t.to}`;
    if (!groups.has(key)) groups.set(key, { ...t, ids: [], symbols: [] });
    groups.get(key).ids.push(t.id);
    groups.get(key).symbols.push(t.symbol);
  }
  return [...groups.values()];
}

// MT: una llamada a sub-máquina va al estado de aceptación (✓) y, si son otros,
// a los de rechazo (✗) y sin respuesta (∞), con una arista aparte para cada uno.
function callEdges(t) {
  if (!t.call) return [{ ...t, ids: [t.id] }];
  const outs = [['✓', t.to], ['✗', t.call.reject], ['∞', t.call.none]].filter(([, to]) => to != null);
  const byTarget = new Map();
  outs.forEach(([mark, to]) => byTarget.set(to, (byTarget.get(to) ?? '') + mark));
  return [...byTarget].map(([to, marks], i) => (i === 0
    ? { ...t, ids: [t.id], marks }
    : { ...t, id: `${t.id}${marks}`, to, ids: [t.id], callOnly: `@${t.call.alias} ${marks}` }));
}

function svgEl(tag, attrs = {}, classes = []) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.classList.add(...classes.filter(Boolean));
  return el;
}

// Geometría de una arista: bucle, recta, o curva si hay aristas paralelas/inversas.
function edgeGeometry(t, from, to, transitions) {
  if (t.from === t.to) {
    const { x, y } = from;
    return {
      d: `M ${x - 10} ${y - r + 4} C ${x - 42} ${y - r - 32}, ${x + 42} ${y - r - 32}, ${x + 10} ${y - r + 4}`,
      midX: x,
      midY: y - r - 18
    };
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const sx = from.x + ux * r;
  const sy = from.y + uy * r;
  const ex = to.x - ux * r;
  const ey = to.y - uy * r;

  const samePair = transitions.filter(rt =>
    (rt.from === t.from && rt.to === t.to) || (rt.from === t.to && rt.to === t.from)
  );
  const hasReverse = transitions.some(rt => rt.from === t.to && rt.to === t.from);

  if (!hasReverse && samePair.length <= 1) {
    return { d: `M ${sx} ${sy} L ${ex} ${ey}`, midX: (sx + ex) / 2, midY: (sy + ey) / 2 };
  }

  const pairIndex = samePair.findIndex(rt => rt.id === t.id);
  const spread = samePair.length > 1 ? (pairIndex - (samePair.length - 1) / 2) * 46 : 0; // rótulos de 20px sin pisarse
  const offset = (hasReverse ? 38 : 0) + spread;
  const cpx = (sx + ex) / 2 - uy * offset;
  const cpy = (sy + ey) / 2 + ux * offset;
  return {
    d: `M ${sx} ${sy} Q ${cpx} ${cpy} ${ex} ${ey}`,
    // Punto medio de la Bézier cuadrática (t = 0.5)
    midX: 0.25 * sx + 0.5 * cpx + 0.25 * ex,
    midY: 0.25 * sy + 0.5 * cpy + 0.25 * ey
  };
}

export const canvas = {
  renderCanvas() {
    this.edgesGroup.innerHTML = '';
    this.statesGroup.innerHTML = '';
    const edges = this.state.automatonType === 'afd'
      ? groupEdges(this.state.transitions)
      : this.state.transitions.flatMap(callEdges);
    edges.forEach(t => this.renderEdge(t, edges));
    this.state.states.forEach(s => this.renderState(s));
  },

  renderEdge(t, edges) {
    const from = this.getState(t.from);
    const to = this.getState(t.to);
    if (!from || !to) return;

    const isActive = t.ids.some(id => has(this.state.activeTransition, id));
    const type = this.state.automatonType;
    const theme = typeClass(type);
    const geo = edgeGeometry(t, from, to, edges);
    const { d, midX } = geo;
    // Varios bucles en un mismo estado: los rótulos se apilan hacia arriba
    const loopIndex = t.from === t.to ? edges.filter(e => e.from === t.from && e.to === t.to).findIndex(e => e.id === t.id) : 0;
    const midY = geo.midY - loopIndex * 22;

    const g = svgEl('g', {}, ['edge-group']);
    g.dataset.ids = t.ids.join(',');
    if (t.ids.some(id => this.state.selection.transitions.includes(id))) g.classList.add('is-selected');

    const marker = isActive ? `url(#arrow-active${MARKER_SUFFIX[type]})` : 'url(#arrow-default)';
    g.appendChild(svgEl('path', { d, 'marker-end': marker },
      ['edge-path', isActive && 'is-active', isActive && theme]));
    g.appendChild(svgEl('path', { d }, ['edge-hit']));

    const label = t.symbols ? t.symbols.join(', ')
      : t.callOnly ? t.callOnly
      : AUTOMATA[type].label(t) + (t.output ? `, ${t.output}` : '') + (t.call ? ` ${callLabel(t.call)} ${t.marks}` : '');
    const labelW = label.length * 7 + 14;
    g.appendChild(svgEl('rect',
      { x: midX - labelW / 2, y: midY - 10, width: labelW, height: 20, rx: 10 }, ['edge-label-bg']));
    const text = svgEl('text', { x: midX, y: midY }, ['edge-label', theme]);
    text.textContent = label;
    g.appendChild(text);

    this.edgesGroup.appendChild(g);
  },

  renderState(s) {
    const type = this.state.automatonType;
    const g = svgEl('g', { transform: `translate(${s.x}, ${s.y})` }, [
      'state-node',
      typeClass(type),
      s.isStart && 'is-start',
      s.isFinal && 'is-final',
      this.state.selection.states.includes(s.id) && 'is-selected',
      this.state.connectFrom === s.id && 'connecting-source',
      has(this.state.currentTestState, s.id) && 'current'
    ]);
    g.dataset.id = s.id;

    if (s.isStart) {
      g.appendChild(svgEl('path', {
        d: `M ${-r - 22} 0 L ${-r - 4} 0`,
        'marker-end': `url(#arrow-start${MARKER_SUFFIX[type]})`
      }, ['state-start-arrow', typeClass(type)]));
    }

    g.appendChild(svgEl('circle', { cx: 0, cy: 0, r }, ['state-circle']));
    if (s.isFinal) g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: r - 6 }, ['state-final-ring']));

    const text = svgEl('text', {}, ['state-label']);
    text.textContent = s.label;
    // Rótulos largos (p. ej. "[e0,e1]" del pasaje a AFD) se achican para entrar en el círculo
    if (s.label.length > 4) text.style.fontSize = `${Math.max(7, Math.min(14, (2 * r - 8) / (0.6 * s.label.length)))}px`;
    g.appendChild(text);

    this.statesGroup.appendChild(g);
  }
};
