// Dibujo del autómata en el SVG (estados y aristas).
import { STATE_RADIUS as r, typeClass } from '../state.js';
import { AUTOMATA } from '../engine/automata.js';

const NS = 'http://www.w3.org/2000/svg';
const MARKER_SUFFIX = { afd: '', apd: '-stack', mt: '-tape' }; // ids de <marker> en index.html

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
  const spread = samePair.length > 1 ? (pairIndex - (samePair.length - 1) / 2) * 30 : 0;
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
    this.state.transitions.forEach(t => this.renderEdge(t));
    this.state.states.forEach(s => this.renderState(s));
  },

  renderEdge(t) {
    const from = this.getState(t.from);
    const to = this.getState(t.to);
    if (!from || !to) return;

    const isActive = this.state.activeTransition === t.id;
    const type = this.state.automatonType;
    const theme = typeClass(type);
    const { d, midX, midY } = edgeGeometry(t, from, to, this.state.transitions);

    const g = svgEl('g', {}, ['edge-group']);
    g.dataset.id = t.id;

    const marker = isActive ? `url(#arrow-active${MARKER_SUFFIX[type]})` : 'url(#arrow-default)';
    g.appendChild(svgEl('path', { d, 'marker-end': marker },
      ['edge-path', isActive && 'is-active', isActive && theme]));
    g.appendChild(svgEl('path', { d }, ['edge-hit']));

    const label = AUTOMATA[type].label(t) + (t.output ? `, ${t.output}` : '');
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
      this.state.selectedState === s.id && 'is-selected',
      this.state.connectFrom === s.id && 'connecting-source',
      this.state.currentTestState === s.id && 'current'
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
    g.appendChild(text);

    this.statesGroup.appendChild(g);
  }
};
