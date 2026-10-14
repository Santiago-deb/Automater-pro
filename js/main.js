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
import { drive } from './ui/drive.js';

const $ = id => document.getElementById(id);
const parseList = value => value.split(',').map(s => s.trim()).filter(s => s.length > 0);

const App = Object.assign({ state: createState() }, actions, interaction, canvas, panel, modals, tapeView, help, tour, files, drive, {
  init() {
    this.svg = $('canvas');
    this.viewport = $('viewport');
    this.edgesGroup = $('edges-group');
    this.statesGroup = $('states-group');

    this.bindEvents();
    this.bindHelp();
    this.bindFileMenu();
    this.restoreSession();
    this.updateHint();
    this.render();
  },

  bindEvents() {
    const on = (id, event, fn) => $(id).addEventListener(event, fn);

    document.querySelectorAll('.type-btn').forEach(btn =>
      btn.addEventListener('click', () => this.switchType(btn.dataset.type)));
    document.querySelectorAll('.tool-btn').forEach(btn =>
      btn.addEventListener('click', () => this.setMode(btn.dataset.mode)));

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
    on('alphabetInput', 'input', e => { this.state.alphabet = parseList(e.target.value); this.renderTransList(); });
    on('stackAlphabetInput', 'input', e => { this.state.stackAlphabet = parseList(e.target.value); this.renderTransList(); });
    on('initialStackInput', 'input', e => { this.state.initialStackSymbol = e.target.value.trim(); this.renderTransList(); });
    on('tapeAlphabetInput', 'input', e => { this.state.tapeAlphabet = parseList(e.target.value); });
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
    on('tapeModal', 'click', e => { if (e.target.id === 'tapeModal') this.closeTapeModal(); this.closeHelp(); });
    on('tapeModalConfirm', 'click', () => this.confirmTapeTransition());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { this.closeSymbolModal(); this.closeStackModal(); this.closeTapeModal(); this.closeHelp(); }
    });
  }
});

// Los módulos se ejecutan diferidos: el DOM ya está parseado.
App.init();
