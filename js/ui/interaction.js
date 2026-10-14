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

  handlePointerDown(e) {
    const stateEl = e.target.closest('.state-node');
    const isEmpty = !stateEl && !e.target.closest('.edge-group');

    // Clic derecho, o touch en área vacía en modo select → pan
    if (e.button === 2 || (e.pointerType === 'touch' && isEmpty && this.state.mode === 'select')) {
      this.state.panning = true;
      this.state.panStart = { x: e.clientX, y: e.clientY };
      this.state.panCamStart = { x: this.state.camera.x, y: this.state.camera.y };
      this.svg.classList.add('panning');
      return;
    }

    if (stateEl && this.state.mode === 'select' && e.button === 0) {
      const id = parseInt(stateEl.dataset.id);
      const st = this.getState(id);
      if (!st) return;
      const screen = this.getScreenPos(e);
      const world = this.getWorldPos(e);
      this.state.pendingDrag = {
        id,
        startScreenX: screen.x,
        startScreenY: screen.y,
        offsetX: world.x - st.x,
        offsetY: world.y - st.y,
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

    const pd = this.state.pendingDrag;
    if (!pd) return;
    const screen = this.getScreenPos(e);
    // Umbral de 3px para distinguir clic de arrastre
    if (!pd.active && (Math.abs(screen.x - pd.startScreenX) > 3 || Math.abs(screen.y - pd.startScreenY) > 3)) {
      pd.active = true;
    }
    if (!pd.active) return;

    const st = this.getState(pd.id);
    if (st) {
      const world = this.getWorldPos(e);
      st.x = world.x - pd.offsetX;
      st.y = world.y - pd.offsetY;
      this.renderCanvas();
    }
  },

  handlePointerUp() {
    if (this.state.panning) {
      this.state.panning = false;
      this.svg.classList.remove('panning');
      return;
    }
    // Evita que el click que sigue a un arrastre seleccione/alterne el estado
    if (this.state.pendingDrag?.active) {
      this.scheduleSave(); // la posición nueva también se guarda
      this.state.suppressClick = true;
      setTimeout(() => { this.state.suppressClick = false; }, 50);
    }
    this.state.pendingDrag = null;
  },

  handleClick(e) {
    if (this.state.suppressClick) return;
    const stateEl = e.target.closest('.state-node');
    const edgeEl = e.target.closest('.edge-group');

    if (stateEl) {
      this.handleStateClick(parseInt(stateEl.dataset.id));
    } else if (edgeEl) {
      if (this.state.mode === 'delete') this.deleteTransition(parseInt(edgeEl.dataset.id));
    } else if (this.state.mode === 'add') {
      const pos = this.getWorldPos(e);
      this.addState(pos.x, pos.y);
    } else {
      this.state.selectedState = null;
      this.state.connectFrom = null;
      this.render();
    }
  },

  handleStateClick(id) {
    const st = this.getState(id);
    if (!st) return;

    switch (this.state.mode) {
      case 'select':
        this.state.selectedState = id;
        this.render();
        break;
      case 'add':
        st.isFinal = !st.isFinal;
        this.render();
        this.showToast(`${st.label} ${st.isFinal ? 'ahora es final' : 'ya no es final'}`, 'success');
        break;
      case 'connect':
        if (!this.state.connectFrom) {
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
