// Menú de un estado: se abre con doble clic (o doble toque) en cualquier modo
// menos Eliminar. Tiene lo que se puede hacer con un estado: renombrarlo,
// hacerlo inicial, marcarlo o desmarcarlo como final, sacar una transición
// desde él y eliminarlo.
import { STATE_RADIUS } from '../state.js';

const $ = id => document.getElementById(id);

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export const stateMenu = {
  openStateMenu(id) {
    this.closeStateMenu();
    const st = this.getState(id);
    if (!st) return;

    const menu = el('div', 'state-menu');
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', `Opciones de ${st.label}`);
    menu.addEventListener('pointerdown', e => e.stopPropagation());

    const name = el('input', 'input mono state-menu-input');
    name.value = st.label;
    name.setAttribute('aria-label', 'Nombre del estado');
    name.maxLength = 12;
    const rename = () => { if (this.renameState(id, name.value)) this.closeStateMenu(); };
    name.addEventListener('keydown', e => {
      if (e.key === 'Enter') rename();
      if (e.key === 'Escape') this.closeStateMenu();
      e.stopPropagation(); // Ctrl+Z / Supr dentro del campo son del campo
    });
    const ok = el('button', 'btn state-menu-ok', 'Renombrar');
    ok.addEventListener('click', rename);
    const nameRow = el('div', 'state-menu-name');
    nameRow.append(name, ok);

    const item = (text, run, cls = '') => {
      const b = el('button', `state-menu-item ${cls}`, text);
      b.setAttribute('role', 'menuitem');
      b.addEventListener('click', () => { this.closeStateMenu(); run(); });
      return b;
    };

    menu.append(
      el('div', 'state-menu-title', `Estado ${st.label}`),
      nameRow,
      st.isStart ? el('p', 'state-menu-note', 'Es el estado inicial') : item('Hacer inicial', () => this.setStart(id)),
      item(st.isFinal ? 'Quitar de finales' : 'Marcar como final', () => this.toggleFinal(id)),
      item('Nueva transición desde acá', () => {
        this.setMode('connect');
        this.state.connectFrom = id;
        this.render();
        this.showToast(`Ahora elige el estado destino (${st.label} de nuevo = bucle)`, 'success');
      }),
      item('Eliminar estado', () => this.deleteState(id), 'danger')
    );

    const area = this.svg.parentElement;
    area.appendChild(menu);
    // Al lado del estado, sin salirse del tablero
    const { x: cx, y: cy, scale } = this.state.camera;
    const svgBox = this.svg.getBoundingClientRect();
    const areaBox = area.getBoundingClientRect();
    const sx = svgBox.left - areaBox.left + cx + st.x * scale;
    const sy = svgBox.top - areaBox.top + cy + st.y * scale;
    const gap = STATE_RADIUS * scale + 10;
    let left = sx + gap;
    if (left + menu.offsetWidth > areaBox.width - 8) left = sx - gap - menu.offsetWidth;
    left = Math.max(8, Math.min(left, areaBox.width - menu.offsetWidth - 8));
    const top = Math.max(8, Math.min(sy - 40, areaBox.height - menu.offsetHeight - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    this._closeMenuOutside = e => { if (!menu.contains(e.target)) this.closeStateMenu(); };
    setTimeout(() => document.addEventListener('pointerdown', this._closeMenuOutside), 0);
    // En pantallas táctiles no se enfoca el campo: abriría el teclado
    if (matchMedia('(pointer: fine)').matches) { name.focus({ preventScroll: true }); name.select(); }
  },

  closeStateMenu() {
    document.querySelector('.state-menu')?.remove();
    if (this._closeMenuOutside) document.removeEventListener('pointerdown', this._closeMenuOutside);
    this._closeMenuOutside = null;
  }
};
