// Interacción con el lienzo: pan & zoom, arrastre de estados y clics.
import { STATE_RADIUS } from '../state.js';

export const interaction = {
  applyTransform() {
    const { x, y, scale } = this.state.camera;
    this.viewport.setAttribute('transform', `translate(${x}, ${y}) scale(${scale})`);
  },

  handleWheel(e) {
    e.preventDefault();
    const { x, y } = this.getScreenPos(e);
    this.zoomAt(e.deltaY < 0 ? 1.1 : 0.9, x, y);
  },

  zoom(factor) {
    const rect = this.svg.getBoundingClientRect();
    this.zoomAt(factor, rect.width / 2, rect.height / 2);
  },

  zoomAt(factor, centerX, centerY) {
    const cam = this.state.camera;
    const newScale = Math.max(0.2, Math.min(4, cam.scale * factor));
    const worldX = (centerX - cam.x) / cam.scale;
    const worldY = (centerY - cam.y) / cam.scale;
    cam.scale = newScale;
    cam.x = centerX - worldX * newScale;
    cam.y = centerY - worldY * newScale;
    this.applyTransform();
  },

  fitToView() {
    const states = this.state.states;
    const r = STATE_RADIUS * 2; // Margen generoso
    const minX = Math.min(...states.map(s => s.x)) - r;
    const maxX = Math.max(...states.map(s => s.x)) + r;
    const minY = Math.min(...states.map(s => s.y)) - r;
    const maxY = Math.max(...states.map(s => s.y)) + r;
    const width = maxX - minX;
    const height = maxY - minY;

    if (states.length === 0 || width === 0 || height === 0) {
      this.state.camera = { x: 0, y: 0, scale: 1 };
      this.applyTransform();
      return;
    }

    const rect = this.svg.getBoundingClientRect();
    const scale = Math.min(rect.width / width, rect.height / height, 1.5);
    this.state.camera = {
      scale,
      x: (rect.width - width * scale) / 2 - minX * scale,
      y: (rect.height - height * scale) / 2 - minY * scale
    };
    this.applyTransform();
  },

  getScreenPos(e) {
    const rect = this.svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  },

  getWorldPos(e) {
    const screen = this.getScreenPos(e);
    const { x, y, scale } = this.state.camera;
    return { x: (screen.x - x) / scale, y: (screen.y - y) / scale };
  },

  // ---------- Selección ----------
  clearSelection() {
    this.state.selection = { states: [], transitions: [] };
  },

  // Quita de la selección lo que ya no existe (después de borrar).
  pruneSelection() {
    const sel = this.state.selection;
    sel.states = sel.states.filter(id => this.getState(id));
    sel.transitions = sel.transitions.filter(id => this.state.transitions.some(t => t.id === id));
  },

  // kind: 'states' | 'transitions'. Con Shift suma o quita; sin Shift queda solo eso.
  pick(kind, ids, toggle) {
    const sel = this.state.selection;
    if (!toggle) {
      this.clearSelection();
      this.state.selection[kind] = [...ids];
    } else if (ids.every(id => sel[kind].includes(id))) {
      sel[kind] = sel[kind].filter(id => !ids.includes(id));
    } else {
      sel[kind] = [...new Set([...sel[kind], ...ids])];
    }
    this.render();
  },

  // Lo que toca el rectángulo (en coordenadas del mundo): estados cuyo círculo
  // lo corta y aristas con algún punto del trazo o el rótulo adentro.
  hitsInRect(a, b) {
    const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
    const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
    const inside = p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2;
    const states = this.state.states.filter(s => {
      const dx = s.x - Math.max(x1, Math.min(s.x, x2));
      const dy = s.y - Math.max(y1, Math.min(s.y, y2));
      return dx * dx + dy * dy <= STATE_RADIUS * STATE_RADIUS;
    }).map(s => s.id);
    const transitions = new Set();
    this.edgesGroup.querySelectorAll('.edge-group').forEach(g => {
      const path = g.querySelector('.edge-path');
      const len = path.getTotalLength();
      const label = g.querySelector('.edge-label');
      const touched = inside({ x: +label.getAttribute('x'), y: +label.getAttribute('y') }) ||
        Array.from({ length: 17 }, (_, k) => path.getPointAtLength(len * k / 16)).some(inside);
      if (touched) g.dataset.ids.split(',').forEach(id => transitions.add(Number(id)));
    });
    return { states, transitions: [...transitions] };
  },

  drawMarquee() {
    const m = this.state.marquee;
    let rect = this.viewport.querySelector('.marquee');
    if (!m?.active) return rect?.remove();
    if (!rect) {
      rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.classList.add('marquee');
      this.viewport.appendChild(rect);
    }
    rect.setAttribute('x', Math.min(m.start.x, m.end.x));
    rect.setAttribute('y', Math.min(m.start.y, m.end.y));
    rect.setAttribute('width', Math.abs(m.end.x - m.start.x));
    rect.setAttribute('height', Math.abs(m.end.y - m.start.y));
    rect.setAttribute('stroke-width', 1.5 / this.state.camera.scale);
  },

  // ---------- Puntero ----------
  // Todos los modos menos Eliminar comparten: arrastrar estados (todos los
  // seleccionados juntos), Shift + clic y, con el mouse, el rectángulo.
  // Un clic sin arrastrar hace lo propio del modo (agregar, conectar…).
  handlePointerDown(e) {
    const stateEl = e.target.closest('.state-node');
    const isEmpty = !stateEl && !e.target.closest('.edge-group');
    const mode = this.state.mode;
    const editing = mode !== 'delete';
    this.closeStateMenu();

    // Clic derecho, o touch en área vacía en modo select → pan
    if (e.button === 2 || (e.pointerType === 'touch' && isEmpty && mode === 'select')) {
      this.state.panning = true;
      this.state.panStart = { x: e.clientX, y: e.clientY };
      this.state.panCamStart = { x: this.state.camera.x, y: this.state.camera.y };
      this.svg.classList.add('panning');
      return;
    }
    if (e.button !== 0 || !editing) return;

    if (isEmpty && e.pointerType !== 'touch') {
      const world = this.getWorldPos(e);
      const sel = this.state.selection;
      this.state.marquee = {
        start: world, end: world, screen: this.getScreenPos(e), active: false,
        base: e.shiftKey ? { states: [...sel.states], transitions: [...sel.transitions] } : { states: [], transitions: [] }
      };
      return;
    }

    if (stateEl && !e.shiftKey) {
      const id = parseInt(stateEl.dataset.id);
      if (!this.getState(id)) return;
      // Si se arrastra un estado que no estaba seleccionado, se mueve solo ese
      const group = this.state.selection.states.includes(id) ? this.state.selection.states : [id];
      const screen = this.getScreenPos(e);
      this.state.pendingDrag = {
        id,
        group: group.map(gid => ({ id: gid, x: this.getState(gid).x, y: this.getState(gid).y })),
        startWorld: this.getWorldPos(e),
        startScreenX: screen.x,
        startScreenY: screen.y,
        active: false
      };
    }
  },

  handlePointerMove(e) {
    if (this.state.panning) {
      this.state.camera.x = this.state.panCamStart.x + e.clientX - this.state.panStart.x;
      this.state.camera.y = this.state.panCamStart.y + e.clientY - this.state.panStart.y;
      this.applyTransform();
      return;
    }

    const screen = this.getScreenPos(e);
    const moved = (x, y) => Math.abs(screen.x - x) > 3 || Math.abs(screen.y - y) > 3; // clic vs. arrastre

    const m = this.state.marquee;
    if (m) {
      if (!m.active && !moved(m.screen.x, m.screen.y)) return;
      m.active = true;
      m.end = this.getWorldPos(e);
      const hit = this.hitsInRect(m.start, m.end);
      this.state.selection = {
        states: [...new Set([...m.base.states, ...hit.states])],
        transitions: [...new Set([...m.base.transitions, ...hit.transitions])]
      };
      this.renderCanvas();
      this.drawMarquee();
      return;
    }

    const pd = this.state.pendingDrag;
    if (!pd) return;
    if (!pd.active && !moved(pd.startScreenX, pd.startScreenY)) return;
    pd.active = true;
    const world = this.getWorldPos(e);
    pd.group.forEach(({ id, x, y }) => {
      const st = this.getState(id);
      if (st) { st.x = x + world.x - pd.startWorld.x; st.y = y + world.y - pd.startWorld.y; }
    });
    this.renderCanvas();
  },

  handlePointerUp() {
    if (this.state.panning) {
      this.state.panning = false;
      this.svg.classList.remove('panning');
      return;
    }
    // Evita que el click que sigue a un arrastre seleccione/agregue/deseleccione
    const dragged = this.state.pendingDrag?.active || this.state.marquee?.active;
    if (dragged) {
      this.scheduleSave(); // la posición nueva también se guarda
      this.state.suppressClick = true;
      setTimeout(() => { this.state.suppressClick = false; }, 50);
    }
    if (this.state.marquee) {
      this.state.marquee = null;
      this.drawMarquee();
      if (dragged) this.render();
    }
    this.state.pendingDrag = null;
  },

  handleClick(e) {
    if (this.state.suppressClick) return;
    const stateEl = e.target.closest('.state-node');
    const edgeEl = e.target.closest('.edge-group');
    const mode = this.state.mode;

    if (stateEl) {
      this.handleStateClick(parseInt(stateEl.dataset.id), e);
    } else if (edgeEl) {
      const ids = edgeEl.dataset.ids.split(',').map(Number);
      if (mode === 'delete') this.deleteTransition(ids);
      else this.pick('transitions', ids, e.shiftKey);
    } else if (mode === 'add' && !e.shiftKey) {
      const pos = this.getWorldPos(e);
      this.clearSelection();
      this.addState(pos.x, pos.y);
    } else {
      this.clearSelection();
      this.state.connectFrom = null;
      this.render();
    }
  },

  // Dos clics (o toques) seguidos sobre el mismo estado abren su menú
  // (en Conectar, en cambio, crean un bucle: ver handleStateClick).
  isDoubleClick(id) {
    const now = Date.now();
    const last = this._lastStateClick;
    this._lastStateClick = { id, time: now };
    if (last?.id === id && now - last.time < 350) {
      this._lastStateClick = null;
      return true;
    }
    return false;
  },

  handleStateClick(id, e) {
    const st = this.getState(id);
    if (!st) return;
    const mode = this.state.mode;

    if (mode !== 'delete' && mode !== 'connect' && this.isDoubleClick(id)) {
      this.state.connectFrom = null;
      this.pick('states', [id], false);
      this.openStateMenu(id);
      return;
    }

    switch (mode) {
      case 'select':
      case 'add':
        this.pick('states', [id], e.shiftKey);
        break;
      case 'connect':
        if (e.shiftKey) {
          this.pick('states', [id], true);
        } else if (!this.state.connectFrom) {
          this.state.connectFrom = id;
          this.render();
        } else {
          this.openTransitionModal(this.state.connectFrom, id); // mismo id = bucle
          this.state.connectFrom = null;
        }
        break;
      case 'delete':
        this.deleteState(id);
        break;
    }
  }
};
