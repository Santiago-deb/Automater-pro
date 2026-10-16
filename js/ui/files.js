// Archivo: autoguardado por tipo en el navegador, guardar/abrir .json (y abrir .MT de MTSolution),
// exportar el diagrama como SVG o PNG (también con fondo blanco para imprimir)
// y "Deshacer" en el toast de las acciones que reemplazan el tablero.
import { AUTOMATA } from '../engine/automata.js';
import { parseMTFile } from '../engine/table.js';

const $ = id => document.getElementById(id);
const KEY = type => `automater:v1:${type}`;
const TYPE_KEY = 'automater:v1:type';
export const FIELDS = ['alphabet', 'stackAlphabet', 'initialStackSymbol', 'tapeAlphabet', 'tapeCount', 'modules', 'states', 'transitions'];

// localStorage puede no existir o fallar (modo privado, cuota): nunca rompe la app
const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin autoguardado */ } }
};

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Los .MT de MTSolution vienen en latin1; los nuestros, en UTF-8
async function readText(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('latin1').decode(buf); }
}

// Un archivo elegido → autómata "plano" ({ type, states, transitions, alphabet, … }) o { error }.
async function readAutomaton(file) {
  const text = await readText(file);
  if (/\.mt$/i.test(file.name)) {
    const r = parseMTFile(text);
    if (r.error) return { error: `${file.name}: ${r.error}` };
    return { type: 'mt', alphabet: r.alphabet, tapeAlphabet: r.tapeAlphabet, tapeCount: r.tapeCount, modules: r.modules, ...r.automaton };
  }
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  return validAutomaton(data) ? data : { error: `${file.name} no es un autómata guardado con Automater Pro ni un .MT de MTSolution` };
}

// Completa los módulos (y los módulos de los módulos) con los archivos elegidos,
// buscándolos por nombre. Devuelve los nombres de archivo que siguen faltando.
function resolveModules(modules, pool, depth = 0) {
  const missing = [];
  for (const [alias, mod] of Object.entries(modules ?? {})) {
    const found = pool.get(mod.file.toLowerCase());
    if (found && depth < 8) mod.automaton = structuredClone(found);
    if (!mod.automaton) { missing.push(mod.file); continue; }
    missing.push(...resolveModules(mod.automaton.modules, pool, depth + 1).map(f => `${f} (de ${alias})`));
  }
  return missing;
}

async function readAll(files) {
  const pool = new Map();
  const errors = [];
  for (const f of files) {
    const a = await readAutomaton(f);
    if (a.error) errors.push(a.error);
    else pool.set(f.name.toLowerCase(), a);
  }
  return { pool, errors };
}

function pickFiles(multiple, onPick) {
  const input = $('fileInput');
  input.value = '';
  input.multiple = multiple;
  input.onchange = () => { if (input.files.length) onPick([...input.files]); };
  input.click();
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

function validAutomaton(data) {
  return data && AUTOMATA[data.type] && Array.isArray(data.states) && Array.isArray(data.transitions) &&
    data.states.every(s => Number.isFinite(s.id) && typeof s.label === 'string') &&
    data.transitions.every(t => data.states.some(s => s.id === t.from) && data.states.some(s => s.id === t.to));
}

// Colores del diagrama exportado para imprimir (sobre blanco)
const PRINT_VARS = {
  '--bg-deep': '#ffffff', '--bg-elev': '#ffffff', '--fg': '#111111', '--fg-muted': '#555555',
  '--border-light': '#888888', '--accent': '#2e7d00', '--final': '#c62828',
  '--type': 'var(--accent)'
};
const PRINT_TYPE = { apd: '#00838f', mt: '#6a3fc7' };

export const files = {
  serialize() {
    const data = { app: 'automater-pro', version: 1, type: this.state.automatonType, testString: $('testString').value };
    FIELDS.forEach(f => { data[f] = structuredClone(this.state[f]); });
    return data;
  },

  // Carga un autómata (de un archivo, del autoguardado o de una herramienta).
  applyAutomaton(data, { fit = true } = {}) {
    if (data.type !== this.state.automatonType) this.setTypeUI(data.type);
    this.resetAutomaton();
    const s = this.state;
    s.states = structuredClone(data.states);
    s.transitions = structuredClone(data.transitions);
    s.nextId = Math.max(0, ...s.states.map(x => x.id)) + 1;
    s.nextTransId = Math.max(0, ...s.transitions.map(x => x.id)) + 1;
    s.selection = { states: [], transitions: [] };
    s.connectFrom = null;
    if (data.alphabet) s.alphabet = [...data.alphabet];
    if (data.stackAlphabet) s.stackAlphabet = [...data.stackAlphabet];
    if (data.initialStackSymbol) s.initialStackSymbol = data.initialStackSymbol;
    if (data.tapeAlphabet) s.tapeAlphabet = [...data.tapeAlphabet];
    if (data.tapeCount) s.tapeCount = data.tapeCount;
    s.modules = structuredClone(data.modules ?? {});
    $('alphabetInput').value = s.alphabet.join(', ');
    $('stackAlphabetInput').value = s.stackAlphabet.join(', ');
    $('initialStackInput').value = s.initialStackSymbol;
    $('tapeAlphabetInput').value = s.tapeAlphabet.join(', ');
    $('tapeCountInput').value = s.tapeCount;
    if (data.testString !== undefined) $('testString').value = data.testString;
    this.updateHint();
    this.render();
    if (fit) this.fitToView();
  },

  // ---------- Autoguardado ----------
  scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      store.set(KEY(this.state.automatonType), this.serialize());
      store.set(TYPE_KEY, this.state.automatonType);
      this.commitHistory();
    }, 300);
  },

  // Al abrir la app o cambiar de tipo: lo último que había, o el ejemplo.
  restoreOrExample(type = this.state.automatonType) {
    const saved = store.get(KEY(type));
    if (validAutomaton(saved) && saved.type === type) this.applyAutomaton(saved);
    else this.loadExample();
  },

  restoreSession() {
    const type = store.get(TYPE_KEY);
    if (AUTOMATA[type] && type !== this.state.automatonType) this.setTypeUI(type);
    this.restoreOrExample();
  },

  // ---------- Deshacer desde el toast ----------
  // Antes de reemplazar el tablero se fija la foto actual en el historial
  // (ver history.js), y el toast ofrece volver a ella.
  remember() {
    this.commitHistory();
  },

  toastWithUndo(msg, type = 'success') {
    this.commitHistory();
    if (!this.canUndo()) return this.showToast(msg, type);
    this.showToast(msg, type, { label: 'Deshacer', run: () => this.undo() });
  },

  // ---------- Guardar / abrir ----------
  saveFile() {
    const blob = new Blob([JSON.stringify(this.serialize(), null, 2)], { type: 'application/json' });
    download(blob, `automater-${this.state.automatonType}-${stamp()}.json`);
    this.showToast('Autómata guardado en tus descargas', 'success');
  },

  // Se pueden elegir varios archivos a la vez: la MT y los módulos que llama.
  openFile() {
    pickFiles(true, async files => {
      const { pool, errors } = await readAll(files);
      if (!pool.size) return this.showToast(errors[0] ?? 'No se pudo abrir el archivo', 'error');
      // La principal es la que no aparece como módulo de otra
      const used = new Set([...pool.values()].flatMap(a => Object.values(a.modules ?? {}).map(m => m.file.toLowerCase())));
      const [name, data] = [...pool].find(([n]) => !used.has(n)) ?? [...pool][0];
      const missing = resolveModules(data.modules, pool);
      this.remember();
      this.applyAutomaton({ testString: '', ...data });
      const shown = files.find(f => f.name.toLowerCase() === name).name;
      if (missing.length) return this.showToast(`Se abrió ${shown}. Faltan módulos: ${missing.join(', ')}`, 'tape', { label: 'Elegir módulos', run: () => this.loadModules() });
      this.toastWithUndo(errors.length ? `Se abrió ${shown}. ${errors.join(' · ')}` : `Se abrió ${shown}`);
    });
  },

  // Carga los archivos de los módulos de la MT del tablero (o reemplaza uno: alias).
  loadModules(alias = null) {
    pickFiles(!alias, async files => {
      const { pool, errors } = await readAll(files);
      if (alias && pool.size) {
        const mod = this.state.modules[alias];
        mod.file = files[0].name;
        mod.automaton = null;
      }
      const missing = resolveModules(this.state.modules, pool);
      this.render();
      const msg = missing.length ? `Faltan módulos: ${missing.join(', ')}` : 'Módulos cargados';
      this.showToast(errors.length ? `${msg} · ${errors.join(' · ')}` : msg, missing.length || errors.length ? 'error' : 'tape');
    });
  },

  // ---------- Exportar imagen ----------
  // Clona el SVG del lienzo, lo recorta al autómata y le incrusta los estilos.
  buildExportSVG(print) {
    const pad = 36;
    const box = this.viewport.getBBox();
    const svg = this.svg.cloneNode(true);
    svg.removeAttribute('id');
    svg.removeAttribute('class');
    svg.querySelectorAll('.edge-hit').forEach(el => el.remove());
    svg.querySelectorAll('.current, .is-active, .is-selected, .connecting-source')
      .forEach(el => el.classList.remove('current', 'is-active', 'is-selected', 'connecting-source'));
    svg.querySelector('#viewport').removeAttribute('transform');

    const w = Math.ceil(box.width + pad * 2);
    const h = Math.ceil(box.height + pad * 2);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', `${box.x - pad} ${box.y - pad} ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);

    // Variables de color: las de la página (con el tipo activo) o las de impresión
    const cs = getComputedStyle(document.body);
    const names = ['--bg-deep', '--bg-elev', '--fg', '--fg-muted', '--border-light', '--accent', '--accent-soft', '--accent-glow',
      '--final', '--type', '--type-soft', '--type-glow'];
    const vars = Object.fromEntries(names.map(n => [n, cs.getPropertyValue(n).trim()]).filter(([, v]) => v));
    if (print) {
      Object.assign(vars, PRINT_VARS);
      vars['--type'] = PRINT_TYPE[this.state.automatonType] ?? PRINT_VARS['--accent'];
      svg.querySelectorAll('marker polygon').forEach(p => {
        p.setAttribute('fill', p.closest('#arrow-default') ? '#555555' : vars['--type']);
      });
    }

    const rules = [];
    for (const sheet of document.styleSheets) {
      if (!sheet.href?.includes('canvas.css')) continue;
      for (const rule of sheet.cssRules) {
        if (/state-|edge-/.test(rule.selectorText ?? '')) rules.push(rule.cssText);
      }
    }
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `svg{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}
      text{font-family:'JetBrains Mono','DejaVu Sans Mono',Consolas,monospace}
      ${rules.join('\n')}`;
    svg.insertBefore(style, svg.firstChild);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    Object.entries({ x: box.x - pad, y: box.y - pad, width: w, height: h, fill: print ? '#ffffff' : vars['--bg-deep'] })
      .forEach(([k, v]) => bg.setAttribute(k, v));
    svg.querySelector('#viewport').before(bg);
    return { text: new XMLSerializer().serializeToString(svg), w, h };
  },

  async exportImage(format, print = false) {
    if (!this.state.states.length) return this.showToast('El tablero está vacío: no hay nada para exportar', 'error');
    const { text, w, h } = this.buildExportSVG(print);
    const name = `automater-${this.state.automatonType}${print ? '-imprimir' : ''}-${stamp()}`;
    if (format === 'svg') {
      download(new Blob([text], { type: 'image/svg+xml' }), `${name}.svg`);
      this.showToast('Diagrama exportado como SVG', 'success');
      return;
    }
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
    try { await img.decode(); } catch { return this.showToast('No se pudo generar la imagen', 'error'); }
    const scale = 2; // nítida al pegarla en un documento
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob(blob => {
      download(blob, `${name}.png`);
      this.showToast(print ? 'Imagen para imprimir exportada' : 'Imagen PNG exportada', 'success');
    }, 'image/png');
  },

  // ---------- Menú Archivo ----------
  bindFileMenu() {
    const btn = $('btnFile');
    const menu = $('fileMenu');
    const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    const open = () => {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      menu.querySelector('button').focus();
    };
    btn.addEventListener('click', e => { e.stopPropagation(); menu.hidden ? open() : close(); });
    document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) close(); });
    menu.addEventListener('keydown', e => {
      const items = [...menu.querySelectorAll('button')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      if (e.key === 'Escape') { e.stopPropagation(); close(); btn.focus(); }
    });

    const actions = {
      new: () => this.clearAll(),
      example: () => { this.remember(); this.loadExample(); this.toastWithUndo('Se cargó el ejemplo', 'success'); },
      open: () => this.openFile(),
      save: () => this.saveFile(),
      png: () => this.exportImage('png'),
      print: () => this.exportImage('png', true),
      svg: () => this.exportImage('svg', true)
    };
    menu.querySelectorAll('[data-file]').forEach(item =>
      item.addEventListener('click', () => { close(); actions[item.dataset.file](); }));
  }
};
