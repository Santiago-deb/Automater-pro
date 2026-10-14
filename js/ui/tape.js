// Visual de las cintas de la MT durante la prueba: la tira se desliza para que
// la celda leída quede bajo la cabeza (▼), y la celda recién escrita destella.
import { BLANK, configuration } from '../engine/mt.js';

const $ = id => document.getElementById(id);
const CELL = 30;        // px, igual que --cell en panel.css
const PAD_RIGHT = 8;    // blancos extra a la derecha para que la cinta "siga"

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// Arma (una sola vez por prueba) la estructura: configuración + una tira por cinta.
function buildView(wrap, tapeCount) {
  const view = el('div', 'tape-view');
  view.dataset.tapes = tapeCount;

  const config = el('div', 'config-row');
  config.append(el('span', 'config-label', tapeCount > 1 ? 'Configuración (C1):' : 'Configuración:'), el('span', 'config-value tape'));
  view.appendChild(config);

  for (let i = 0; i < tapeCount; i++) {
    view.appendChild(el('span', 'tape-label', tapeCount > 1 ? `Cinta ${i + 1}` : 'Cinta'));
    const tape = el('div', 'tape-track');
    tape.appendChild(el('div', 'tape-strip'));
    view.appendChild(tape);
  }
  wrap.replaceChildren(view);
  return view;
}

export const tapeView = {
  renderTapeVisual(step, prev) {
    const wrap = $('stackVisualWrap');
    const k = step.tapes.length;
    let view = wrap.querySelector('.tape-view');
    if (!view || Number(view.dataset.tapes) !== k) view = buildView(wrap, k);

    // Configuración α₁ eᵢ α₂ de la cinta 1 (notación del apunte)
    const label = this.getState(step.state)?.label ?? '?';
    view.querySelector('.config-value').textContent = configuration(step.tapes[0], step.heads[0], label);

    view.querySelectorAll('.tape-strip').forEach((strip, i) => {
      const tape = step.tapes[i];
      const head = step.heads[i];
      const length = Math.max(tape.length, head + 1) + PAD_RIGHT;
      const writtenAt = prev ? prev.heads[i] : -1;
      const changed = prev && prev.tapes[i][writtenAt] !== tape[writtenAt];

      strip.replaceChildren(...Array.from({ length }, (_, pos) => {
        const sym = tape[pos] ?? BLANK;
        const cell = el('div', 'tape-cell', sym);
        if (sym === BLANK) cell.classList.add('blank');
        if (pos === 0) cell.classList.add('first');
        if (pos === head) cell.classList.add('head');
        if (changed && pos === writtenAt) cell.classList.add('written');
        return cell;
      }));
      strip.style.transform = `translateX(${-(head + 0.5) * CELL}px)`;
    });
  }
};
