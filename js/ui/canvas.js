// Dibujo del autómata en el SVG (estados y aristas).
import { STATE_RADIUS as r, typeClass } from '../state.js';
import { AUTOMATA } from '../engine/automata.js';
import { callLabel } from '../engine/mt.js';

const NS = 'http://www.w3.org/2000/svg';
const MARKER_SUFFIX = { afd: '', apd: '-stack', mt: '-tape' }; // ids de <marker> en index.html

// currentTestState / activeTransition pueden ser un id o una lista (AFND)
const has = (value, id) => (Array.isArray(value) ? value.includes(id) : value === id);

// Rótulo de una transición (un renglón).
function edgeText(t, type) {
  return t.callOnly ?? AUTOMATA[type].label(t) + (t.output ? `, ${t.output}` : '') + (t.call ? ` ${callLabel(t.call)} ${t.marks}` : '');
}

// Las transiciones entre el mismo par de estados van en una sola arista (así se
// dibuja en la cursada): en el AF rotulada "a, b"; en el APD y la MT con un
// renglón por transición, uno arriba del otro, y cada renglón se elige o se borra aparte.
function groupEdges(edges, type) {
  const groups = new Map();
  for (const t of edges) {
    const key = `${t.from}>${t.to}`;
    if (!groups.has(key)) groups.set(key, { from: t.from, to: t.to, ids: [], lines: [] });
    const g = groups.get(key);
    g.ids.push(...t.ids);
    g.lines.push({ ids: t.ids, text: edgeText(t, type) });
  }
  const list = [...groups.values()];
  if (type === 'afd') list.forEach(g => { g.lines = [{ ids: g.ids, text: g.lines.map(l => l.text).join(', ') }]; });
  return list;
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

// Geometría de una arista: bucle, recta, o curva si hay otra en sentido contrario.
// (nx, ny) es hacia dónde se aleja el rótulo cuando no entra en un renglón.
function edgeGeometry(t, from, to, edges) {
  if (t.from === t.to) {
    const { x, y } = from;
    return {
      d: `M ${x - 10} ${y - r + 4} C ${x - 42} ${y - r - 32}, ${x + 42} ${y - r - 32}, ${x + 10} ${y - r + 4}`,
      midX: x,
      midY: y - r - 18,
      nx: 0,
      ny: -1
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

  if (!edges.some(e => e.from === t.to && e.to === t.from)) {
    return { d: `M ${sx} ${sy} L ${ex} ${ey}`, midX: (sx + ex) / 2, midY: (sy + ey) / 2, nx: 0, ny: 0 };
  }

  const offset = 38;
  const cpx = (sx + ex) / 2 - uy * offset;
  const cpy = (sy + ey) / 2 + ux * offset;
  return {
    d: `M ${sx} ${sy} Q ${cpx} ${cpy} ${ex} ${ey}`,
    // Punto medio de la Bézier cuadrática (t = 0.5)
    midX: 0.25 * sx + 0.5 * cpx + 0.25 * ex,
    midY: 0.25 * sy + 0.5 * cpy + 0.25 * ey,
    nx: -uy,
    ny: ux
  };
}

const LINE_H = 22; // un renglón del rótulo: píldora de 20 px + 2 de aire

export const canvas = {
  renderCanvas() {
    this.edgesGroup.innerHTML = '';
    this.statesGroup.innerHTML = '';
    const edges = groupEdges(this.state.transitions.flatMap(callEdges), this.state.automatonType);
    edges.forEach(t => this.renderEdge(t, edges));
    this.state.states.forEach(s => this.renderState(s));
  },

  renderEdge(t, edges) {
    const from = this.getState(t.from);
    const to = this.getState(t.to);
    if (!from || !to) return;

    const active = ids => ids.some(id => has(this.state.activeTransition, id));
    const selected = ids => ids.some(id => this.state.selection.transitions.includes(id));
    const isActive = active(t.ids);
    const type = this.state.automatonType;
    const theme = typeClass(type);
    const geo = edgeGeometry(t, from, to, edges);

    const g = svgEl('g', {}, ['edge-group']);
    g.dataset.ids = t.ids.join(',');
    if (selected(t.ids)) g.classList.add('is-selected');

    const marker = isActive ? `url(#arrow-active${MARKER_SUFFIX[type]})` : 'url(#arrow-default)';
    g.appendChild(svgEl('path', { d: geo.d, 'marker-end': marker },
      ['edge-path', isActive && 'is-active', isActive && theme]));
    g.appendChild(svgEl('path', { d: geo.d }, ['edge-hit']));

    // Renglones apilados y centrados; si son más de uno, el bloque se corre hacia
    // afuera de la curva (lo que mide de más) para no pisar la arista de vuelta.
    const w = Math.max(...t.lines.map(l => l.text.length * 7 + 14));
    const h = t.lines.length * LINE_H - 2;
    const push = Math.max(0, Math.abs(geo.nx) * w / 2 + Math.abs(geo.ny) * h / 2 - 10);
    const cx = geo.midX + geo.nx * push;
    const cy = geo.midY + geo.ny * push;
    if (t.lines.length > 1) {
      g.appendChild(svgEl('rect', { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: 10 }, ['edge-label-backdrop']));
    }
    t.lines.forEach((line, i) => {
      const y = cy - h / 2 + 10 + i * LINE_H;
      const on = active(line.ids);
      const lg = svgEl('g', {}, ['edge-line', on && 'is-active', on && theme, selected(line.ids) && 'is-selected']);
      lg.dataset.ids = line.ids.join(',');
      lg.appendChild(svgEl('rect', { x: cx - w / 2, y: y - 10, width: w, height: 20, rx: 10 }, ['edge-label-bg']));
      const text = svgEl('text', { x: cx, y }, ['edge-label', theme]);
      text.textContent = line.text;
      lg.appendChild(text);
      g.appendChild(lg);
    });

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
