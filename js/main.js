// Punto de entrada. `App` es un único objeto armado con los métodos de cada
// módulo, así todos comparten `this.state` y pueden llamarse entre sí.
import { createState } from './state.js';
import { actions } from './actions.js';
import { interaction } from './ui/interaction.js';
import { canvas } from './ui/canvas.js';
import { panel } from './ui/panel.js';
import { modals } from './ui/modals.js';
import { tapeView } from './ui/tape.js';
import { help } from './ui/help.js';
import { tour } from './ui/tour.js';
import { files } from './ui/files.js';
import { tools } from './ui/tools.js';
import { history } from './ui/history.js';
import { stateMenu } from './ui/stateMenu.js';

const $ = id => document.getElementById(id);
const parseList = value => value.split(',').map(s => s.trim()).filter(s => s.length > 0);

const App = Object.assign({ state: createState() }, actions, interaction, canvas, panel, modals, tapeView, help, tour, files, tools, history, stateMenu, {
  init() {
    this.svg = $('canvas');
    this.viewport = $('viewport');
    this.edgesGroup = $('edges-group');
    this.statesGroup = $('states-group');

    this.bindEvents();
    this.bindHelp();
    this.bindFileMenu();
    this.bindTools();
    this.restoreSession();
    this.updateHint();
    this.render();
    this.commitHistory(); // foto inicial: lo que se abrió no se puede deshacer
  },

  bindEvents() {
    const on = (id, event, fn) => $(id).addEventListener(event, fn);

    document.querySelectorAll('.type-btn').forEach(btn =>
      btn.addEventListener('click', () => this.switchType(btn.dataset.type)));
    document.querySelectorAll('.tool-btn[data-mode]').forEach(btn =>
      btn.addEventListener('click', () => this.setMode(btn.dataset.mode)));
    on('btnUndo', 'click', () => this.undo());
    on('btnRedo', 'click', () => this.redo());

    // Lienzo: pan & zoom, arrastre y clics
    this.svg.addEventListener('pointerdown', e => this.handlePointerDown(e));
    this.svg.addEventListener('pointermove', e => this.handlePointerMove(e));
    document.addEventListener('pointerup', () => this.handlePointerUp());
    this.svg.addEventListener('click', e => this.handleClick(e));
    this.svg.addEventListener('wheel', e => this.handleWheel(e));
    this.svg.addEventListener('contextmenu', e => e.preventDefault());

    on('zoomIn', 'click', () => this.zoom(1.2));
    on('zoomOut', 'click', () => this.zoom(0.8));
    on('zoomReset', 'click', () => this.fitToView());

    // Alfabetos
    on('alphabetInput', 'input', e => { this.state.alphabet = parseList(e.target.value); this.renderTransList(); this.scheduleSave(); });
    on('stackAlphabetInput', 'input', e => { this.state.stackAlphabet = parseList(e.target.value); this.renderTransList(); this.scheduleSave(); });
    on('initialStackInput', 'input', e => { this.state.initialStackSymbol = e.target.value.trim(); this.renderTransList(); this.scheduleSave(); });
    on('tapeAlphabetInput', 'input', e => { this.state.tapeAlphabet = parseList(e.target.value); this.scheduleSave(); });
    on('tapeCountInput', 'change', e => this.setTapeCount(parseInt(e.target.value)));

    // Verificación y acciones del header
    on('btnVerify', 'click', () => this.verifyString());
    on('testString', 'keypress', e => { if (e.key === 'Enter') this.verifyString(); });
    on('btnClear', 'click', () => this.clearAll());
    on('btnExample', 'click', () => { this.remember(); this.loadExample(); this.toastWithUndo('Se cargó el ejemplo'); });

    // Modales (clic en el fondo o Escape los cierra)
    on('modalCancel', 'click', () => this.closeSymbolModal());
    on('symbolModal', 'click', e => { if (e.target.id === 'symbolModal') this.closeSymbolModal(); });
    on('stackModalCancel', 'click', () => this.closeStackModal());
    on('stackModal', 'click', e => { if (e.target.id === 'stackModal') this.closeStackModal(); });
    on('stackModalConfirm', 'click', () => this.confirmStackTransition());
    on('tapeModalCancel', 'click', () => this.closeTapeModal());
    on('tapeModal', 'click', e => { if (e.target.id === 'tapeModal') this.closeTapeModal(); this.closeHelp(); this.closeTools(); });
    on('tapeModalConfirm', 'click', () => this.confirmTapeTransition());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.closeSymbolModal(); this.closeStackModal(); this.closeTapeModal(); this.closeHelp(); this.closeTools(); this.closeStateMenu();
        if (this.state.selection.states.length || this.state.selection.transitions.length || this.state.connectFrom) {
          this.clearSelection();
          this.state.connectFrom = null;
          this.render();
        }
        return;
      }
      this.handleShortcut(e);
    });
  },

  // Ctrl+Z deshace, Ctrl+Shift+Z (o Ctrl+Y) rehace y Supr borra lo seleccionado.
  // En un campo de texto las teclas son del campo, y con un panel abierto no se toca el tablero.
  handleShortcut(e) {
    const t = e.target;
    if (t.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (document.querySelector('.modal.show') || this._tour) return;
    if (this.state.testing) return;
    const key = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && key === 'z') { e.preventDefault(); this.closeStateMenu(); e.shiftKey ? this.redo() : this.undo(); }
    else if (mod && key === 'y') { e.preventDefault(); this.closeStateMenu(); this.redo(); }
    else if (key === 'delete' || (key === 'backspace' && !mod)) { e.preventDefault(); this.deleteSelection(); }
  }
});

// Los módulos se ejecutan diferidos: el DOM ya está parseado.
App.init();
