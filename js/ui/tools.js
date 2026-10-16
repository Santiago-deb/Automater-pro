// Herramientas para los TPs: un modal con una vista por herramienta. Toda la
// lógica está en js/engine/ (testeada en tests/tools.test.mjs); acá solo se
// arma la interfaz y se muestran los resultados.
import { AUTOMATA } from '../engine/automata.js';
import { isDeterministic, subsetConstruction, minimize, allStrings, countStrings, maxLengthFor } from '../engine/af.js';
import { afToGrammar, grammarText, grammarTuple, derivation, grammarToAF, regexToAF, regexMatcher, afToRegex, LAMBDA } from '../engine/regular.js';
import { formalDefinition, tableText, parseAFTable, parseAPDTable, parseMTTable, parseBatch } from '../engine/table.js';
import { BLANK } from '../engine/mt.js';

const $ = id => document.getElementById(id);
const TYPE_NAME = { afd: 'AF', apd: 'APD', mt: 'MT' };
const show = w => (w === '' ? LAMBDA : w);
const fmtSet = items => (items.length ? `{${items.join(', ')}}` : '∅');

// Crea un elemento: h('p', { class: 'x', onclick: fn }, 'texto', otroNodo)
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('aria-') && v != null) { el.setAttribute(k, String(v)); continue; }
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

function tableEl(headers, rows, rowClass = () => '') {
  return h('div', { class: 'tt-wrap' },
    h('table', { class: 'tt' },
      h('thead', {}, h('tr', {}, headers.map(x => h('th', { scope: 'col' }, x)))),
      h('tbody', {}, rows.map((r, i) => h('tr', { class: rowClass(r, i) }, r.map((c, j) =>
        j === 0 ? h('th', { scope: 'row' }, c) : h('td', {}, c)))))));
}

const field = (labelText, input, hint) =>
  h('div', { class: 'label-input' }, h('label', { for: input.id }, labelText), input, hint && h('p', { class: 'hint' }, hint));

// Inserta texto en la posición del cursor (para λ, ∅, → en celulares)
function insertAt(input, text) {
  const { selectionStart: a = input.value.length, selectionEnd: b = input.value.length } = input;
  input.value = input.value.slice(0, a) + text + input.value.slice(b);
  input.focus();
  input.setSelectionRange(a + text.length, a + text.length);
  input.dispatchEvent(new Event('input'));
}
const chips = (input, symbols) => h('div', { class: 'insert-chips', 'aria-label': 'Insertar símbolo' },
  symbols.map(s => h('button', { type: 'button', class: 'chip', onclick: () => insertAt(input, s), title: `Insertar ${s}` }, s)));

async function copy(text, html) {
  try {
    if (html && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      })]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    return true;
  } catch {
    return false;
  }
}

// Tabla HTML con bordes, para pegar en Word o Google Docs
function tableHTML(headers, rows) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cell = (tag, c) => `<${tag} style="border:1px solid #444;padding:4px 10px;font-family:Consolas,monospace">${esc(c)}</${tag}>`;
  return `<table style="border-collapse:collapse">` +
    `<tr>${headers.map(c => cell('th', c)).join('')}</tr>` +
    rows.map(r => `<tr>${r.map(c => cell('td', c)).join('')}</tr>`).join('') + '</table>';
}

const TOOLS = [
  { id: 'batch', group: 'Probar', name: 'Varias cadenas' },
  { id: 'explore', group: 'Probar', name: 'Explorar el lenguaje' },
  { id: 'formal', group: 'Entregar', name: 'Definición formal' },
  { id: 'subset', group: 'Autómatas finitos', name: 'AFND → AFD' },
  { id: 'minimize', group: 'Autómatas finitos', name: 'Minimizar AFD' },
  { id: 'grammar', group: 'Autómatas finitos', name: 'Gramática regular' },
  { id: 'regex', group: 'Autómatas finitos', name: 'Expresión regular' },
  { id: 'table', group: 'Cargar', name: 'Desde una tabla δ' }
];

const TABLE_FORMATS = {
  afd: {
    example: 'δ    a    b\n→p   q    p\n*q   r    s\n*r   q    -\ns    {q,r} s',
    hint: 'Primera fila: los símbolos. Después, una fila por estado: → (o ->) marca el inicial y * los finales; si no marcas el inicial, es el de la primera fila. Usa - cuando δ no está definida y {q,r} para varios destinos (queda un AFND).'
  },
  apd: {
    example: 'δ(e0, a, Z) = (e0, AZ)\nδ(e0, a, A) = (e0, AA)\nδ(e0, b, A) = (e1, λ)\nδ(e1, b, A) = (e1, λ)\nδ(e1, λ, Z) = (e2, Z)\nFinales: e2',
    hint: 'Una transición por línea: δ(estado, entrada, tope) = (nuevo estado, reemplazo), o en columnas: e0 a Z e1 AZ. λ o ε para no leer entrada o para desapilar. Los símbolos de pila son de un carácter (Z0 se toma como Z). El primer estado es el inicial.'
  },
  mt: {
    example: 'e0 a B a N X D e1\ne0 b B b N X D e2\ne0 B B B N B N e5\ne1 a B a D 1 D e1\ne1 b B b N B N e2\ne1 c B c N B I e3\ne2 b B b D 1 D e2\ne2 c B c N B I e3\ne3 c 1 c D 1 I e3\ne3 d X d N X D e4\ne4 d 1 d D 1 D e4\ne4 B B B N B N e5\nFinales: e5',
    hint: 'Una fila por transición: estado, lo que lee cada cinta, el par nuevo símbolo / movimiento (I, D, N) de cada cinta y el nuevo estado. Con k cintas son 3k + 2 columnas. Marca los finales con *e5 o con una línea "Finales: e5".'
  }
};

export const tools = {
  bindTools() {
    this._tool = 'batch';
    this._toolInputs = {};
    $('btnTools').addEventListener('click', () => this.openTools());
    $('toolsClose').addEventListener('click', () => this.closeTools());
    $('toolsModal').addEventListener('click', e => { if (e.target.id === 'toolsModal') this.closeTools(); });

    const nav = $('toolsNav');
    let group = null;
    for (const t of TOOLS) {
      if (t.group !== group) { group = t.group; nav.append(h('span', { class: 'tools-group' }, group)); }
      nav.append(h('button', {
        class: 'tools-tab', role: 'tab', id: `tool-${t.id}`, 'data-tool': t.id, 'aria-controls': 'toolsView',
        onclick: () => this.showTool(t.id)
      }, t.name));
    }
    nav.addEventListener('keydown', e => {
      const tabs = [...nav.querySelectorAll('.tools-tab')];
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = tabs[(i + step + tabs.length) % tabs.length];
      this.showTool(next.dataset.tool);
      next.focus();
    });
  },

  openTools(id = this._tool) {
    this._toolsReturnFocus = document.activeElement;
    $('toolsModal').classList.add('show');
    this.showTool(id);
    $(`tool-${id}`).focus();
  },

  closeTools() {
    if (!$('toolsModal').classList.contains('show')) return;
    $('toolsModal').classList.remove('show');
    this._toolsReturnFocus?.focus?.();
  },

  showTool(id) {
    this._tool = id;
    document.querySelectorAll('.tools-tab').forEach(tab => {
      const on = tab.dataset.tool === id;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', on);
      tab.tabIndex = on ? 0 : -1;
      if (on) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    const view = $('toolsView');
    view.setAttribute('aria-labelledby', `tool-${id}`);
    const render = {
      batch: this.toolBatch, explore: this.toolExplore, formal: this.toolFormal, subset: this.toolSubset,
      minimize: this.toolMinimize, grammar: this.toolGrammar, regex: this.toolRegex, table: this.toolTable
    }[id];
    view.replaceChildren(...[render.call(this)].flat().filter(Boolean));
    view.scrollTop = 0;
  },

  // Campo cuyo valor sobrevive al cambiar de herramienta
  keep(input, key, initial = '') {
    input.value = this._toolInputs[key] ?? initial;
    input.addEventListener('input', () => { this._toolInputs[key] = input.value; });
    return input;
  },

  intro(title, text) {
    return [h('h4', { class: 'tool-title' }, title), h('p', { class: 'tool-intro' }, text)];
  },

  // Aviso cuando la herramienta es solo para AF
  needsAF() {
    if (this.state.automatonType === 'afd') return null;
    return h('div', { class: 'tool-notice' },
      h('p', {}, `Esta herramienta trabaja con autómatas finitos y el tablero tiene un ${TYPE_NAME[this.state.automatonType]}.`),
      h('button', { class: 'btn', onclick: () => { this.switchType('afd'); this.showTool(this._tool); } }, 'Cambiar a AF'));
  },

  // Reemplaza el tablero por un resultado (con Deshacer)
  applyResult(data, msg) {
    this.remember();
    this.closeTools();
    this.applyAutomaton({ testString: '', ...data });
    this.toastWithUndo(msg);
  },

  // Carga una cadena en "Verificar" y la anima en el tablero
  tryOnBoard(input) {
    this.closeTools();
    $('testString').value = input;
    $('verifySection').scrollIntoView({ block: 'nearest' });
    this.verifyString();
  },

  // Último paso de una corrida: dónde se detuvo y qué salida dejó
  runSummary(r) {
    const last = r.trace.at(-1);
    const label = id => this.getState(id)?.label ?? '?';
    let stop = '—';
    if (last) stop = Array.isArray(last.state) ? fmtSet(last.state.map(label)) : label(last.state);
    let output = '';
    if (last?.output) output = last.output;
    if (last?.tapes) {
      output = last.tapes.map((t, i) => {
        const cells = [...t];
        while (cells.length && cells.at(-1) === BLANK) cells.pop();
        return `${last.tapes.length > 1 ? `C${i + 1}: ` : ''}${cells.join('') || BLANK}`;
      }).join('  ');
    }
    return { stop, output };
  },

  // ---------- Varias cadenas ----------
  toolBatch() {
    const type = this.state.automatonType;
    const input = this.keep(h('textarea', { id: 'batchInput', class: 'input mono', rows: 6, spellcheck: false, placeholder: 'aab\n+ab\n-ba\nλ' }), `batch-${type}`, $('testString').value);
    const results = h('div', { class: 'tool-results', 'aria-live': 'polite' });

    const run = () => {
      const nd = this.nondeterminismWarning();
      if (nd) { results.replaceChildren(h('p', { class: 'form-error' }, nd.msg)); return; }
      const items = parseBatch(input.value);
      if (!items.length) { results.replaceChildren(h('p', { class: 'form-error' }, 'Escribe al menos una cadena.')); return; }
      const sim = AUTOMATA[type].simulate;
      const rows = items.map(it => {
        const r = sim(this.state, it.input);
        return { ...it, r, ...this.runSummary(r), ok: it.expect ? r.result === it.expect : null };
      });
      const hasOut = rows.some(x => x.output);
      const hasExpect = rows.some(x => x.expect);
      const accepted = rows.filter(x => x.r.result === 'accepted').length;
      const misses = rows.filter(x => x.ok === false).length;
      const outName = type === 'mt' ? 'Cintas al final' : 'Traducción';

      const headers = ['Cadena', 'Resultado', 'Se detiene en', ...(hasOut ? [outName] : []), ...(hasExpect ? ['Esperado'] : []), ''];
      const table = h('div', { class: 'tt-wrap' }, h('table', { class: 'tt' },
        h('thead', {}, h('tr', {}, headers.map(x => h('th', { scope: 'col' }, x)))),
        h('tbody', {}, rows.map(x => h('tr', { class: x.ok === false ? 'miss' : '' },
          h('th', { scope: 'row' }, show(x.input)),
          h('td', {}, h('span', { class: `res ${x.r.result}` }, { accepted: 'Aceptada', rejected: 'Rechazada', warning: 'Aviso' }[x.r.result]),
            h('small', { class: 'res-msg' }, x.r.msg.replace(/^[✓✗⚠]\s*/, ''))),
          h('td', {}, x.stop),
          hasOut && h('td', {}, x.output || '—'),
          hasExpect && h('td', {}, x.expect ? h('span', { class: x.ok ? 'ok' : 'bad' }, `${x.ok ? '✓' : '✗'} ${x.expect === 'accepted' ? 'aceptar' : 'rechazar'}`) : '—'),
          h('td', {}, h('button', { class: 'btn btn-sm', onclick: () => this.tryOnBoard(x.input), title: 'Ver el recorrido en el tablero' }, 'Ver'))
        )))));

      const text = tableText(headers.slice(0, -1), rows.map(x => [
        show(x.input), x.r.result === 'accepted' ? 'Aceptada' : x.r.result === 'rejected' ? 'Rechazada' : 'Aviso', x.stop,
        ...(hasOut ? [x.output || '—'] : []), ...(hasExpect ? [x.expect ? (x.ok ? 'coincide' : 'NO coincide') : '—'] : [])
      ]));
      results.replaceChildren(
        h('p', { class: 'tool-summary' },
          `${rows.length} cadena${rows.length > 1 ? 's' : ''} · ${accepted} aceptada${accepted === 1 ? '' : 's'} · ${rows.length - accepted} rechazada${rows.length - accepted === 1 ? '' : 's'}`,
          hasExpect && h('strong', { class: misses ? 'bad' : 'ok' }, misses ? ` · ${misses} no coinciden con lo esperado` : ' · todas coinciden con lo esperado')),
        table,
        h('div', { class: 'tool-actions' }, this.copyButton('Copiar resultados', () => text)));
    };

    return [
      ...this.intro('Varias cadenas', 'Prueba muchas cadenas de una vez y mira cuáles acepta, en qué estado se detiene y qué traduce.'),
      field('Cadenas, una por línea', input, 'λ es la cadena vacía. Opcional: + adelante si debería aceptarse y - si debería rechazarse, para controlar tu diseño.'),
      chips(input, ['λ']),
      h('div', { class: 'tool-actions' }, h('button', { class: 'btn btn-primary', onclick: run }, 'Probar cadenas')),
      results
    ];
  },

  copyButton(label, getText, getHTML) {
    const btn = h('button', { class: 'btn' }, label);
    btn.addEventListener('click', async () => {
      const ok = await copy(getText(), getHTML?.());
      this.showToast(ok ? 'Copiado al portapapeles' : 'No se pudo copiar: selecciona el texto a mano', ok ? 'success' : 'error');
    });
    return btn;
  },

  // ---------- Explorar el lenguaje ----------
  toolExplore() {
    const type = this.state.automatonType;
    const alphabet = this.state.alphabet;
    if (!alphabet.length) return [...this.intro('Explorar el lenguaje', ''), h('p', { class: 'form-error' }, 'Define el alfabeto de entrada primero.')];
    const limit = type === 'mt' ? 4000 : 30000; // la MT es más cara de simular
    const maxN = Math.max(1, maxLengthFor(alphabet.length, limit));
    const len = this.keep(h('input', { id: 'exploreLen', class: 'input mono', type: 'number', min: 0, max: maxN }), 'explore-len', String(Math.min(maxN, 6)));
    const count = h('p', { class: 'hint' });
    const updateCount = () => {
      const n = Math.max(0, Math.min(maxN, +len.value || 0));
      count.textContent = `Σ = {${alphabet.join(', ')}} · se prueban ${countStrings(alphabet.length, n).toLocaleString('es-AR')} cadenas (máximo de longitud: ${maxN}).`;
    };
    len.addEventListener('input', updateCount);
    updateCount();
    const results = h('div', { class: 'tool-results', 'aria-live': 'polite' });

    const run = () => {
      const nd = this.nondeterminismWarning();
      if (nd) { results.replaceChildren(h('p', { class: 'form-error' }, nd.msg)); return; }
      const n = Math.max(0, Math.min(maxN, +len.value || 0));
      len.value = n;
      results.replaceChildren(h('p', { class: 'hint' }, 'Calculando…'));
      requestAnimationFrame(() => setTimeout(() => {
        const sim = AUTOMATA[type].simulate;
        const byLen = new Map();
        const loops = [];
        let total = 0;
        let ok = 0;
        for (const w of allStrings(alphabet, n)) {
          total++;
          const r = sim(this.state, w).result;
          if (r === 'accepted') {
            ok++;
            if (!byLen.has(w.length)) byLen.set(w.length, []);
            byLen.get(w.length).push(w);
          } else if (r === 'warning') loops.push(w);
        }
        const groups = [...byLen.entries()].map(([l, ws]) => h('div', { class: 'lang-row' },
          h('span', { class: 'lang-len' }, `|w| = ${l}`),
          h('div', { class: 'lang-words' }, ws.slice(0, 200).map(w => h('button', { class: 'chip word', onclick: () => this.tryOnBoard(w), title: 'Ver en el tablero' }, show(w))),
            ws.length > 200 && h('span', { class: 'hint' }, ` y ${ws.length - 200} más`))));
        results.replaceChildren(
          h('p', { class: 'tool-summary' }, `Acepta ${ok.toLocaleString('es-AR')} de ${total.toLocaleString('es-AR')} cadenas de longitud ≤ ${n}.`),
          ok ? h('div', { class: 'lang' }, groups) : h('p', {}, 'No acepta ninguna cadena hasta esa longitud.'),
          loops.length > 0 && h('p', { class: 'form-error' }, `No se detuvo (o hubo un aviso) con: ${loops.slice(0, 12).map(show).join(', ')}${loops.length > 12 ? '…' : ''}`),
          h('p', { class: 'hint' }, 'Mirar las cadenas aceptadas ayuda a conjeturar el lenguaje, pero no lo demuestra: después comprueba tu respuesta con la definición.'));
      }, 0));
    };

    return [
      ...this.intro('Explorar el lenguaje', 'Lista todas las cadenas que acepta, ordenadas por longitud. Sirve para los ejercicios de "determine el lenguaje que reconoce".'),
      h('div', { class: 'row-inline' }, field('Longitud máxima', len), h('button', { class: 'btn btn-primary', onclick: run }, 'Listar cadenas aceptadas')),
      count,
      results
    ];
  },

  // ---------- Definición formal ----------
  toolFormal() {
    const type = this.state.automatonType;
    if (!this.state.states.length) return [...this.intro('Definición formal', ''), h('p', {}, 'El tablero está vacío.')];
    const fd = formalDefinition(type, this.state);
    const text = [fd.tuple, fd.signature, '', tableText(fd.headers, fd.rows), ...(fd.lines ? ['', ...fd.lines] : [])].join('\n');
    const html = `<p style="font-family:Consolas,monospace">${fd.tuple.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>${tableHTML(fd.headers, fd.rows)}`;

    const parts = [
      ...this.intro('Definición formal', 'La tupla y la tabla δ con la notación de la cátedra, listas para copiar a tu entrega.'),
      h('pre', { class: 'tuple' }, fd.tuple),
      h('p', { class: 'hint' }, fd.signature),
      tableEl(fd.headers, fd.rows),
      fd.lines && h('details', { class: 'tool-details' }, h('summary', {}, 'Como funciones δ(…) = (…)'), h('pre', { class: 'mono-block' }, fd.lines.join('\n'))),
      h('p', { class: 'hint' }, fd.notes),
      h('div', { class: 'tool-actions' },
        this.copyButton('Copiar como texto', () => text),
        this.copyButton('Copiar tabla para Word / Docs', () => text, () => html),
        h('button', { class: 'btn', onclick: () => this.exportImage('png', true) }, 'Exportar diagrama para imprimir'))
    ];
    if (type === 'afd') parts.push(this.afChecks());
    return parts;
  },

  // Revisiones útiles en un AF: estados sin camino desde el inicial y δ incompleta
  afChecks() {
    const { states, transitions, alphabet } = this.state;
    const start = states.find(s => s.isStart);
    const notes = [];
    if (!start) notes.push(h('li', {}, 'No hay estado inicial: márcalo con ▶ en la lista de estados.'));
    if (start) {
      const seen = new Set([start.id]);
      const queue = [start.id];
      while (queue.length) { const id = queue.shift(); transitions.forEach(t => { if (t.from === id && !seen.has(t.to)) { seen.add(t.to); queue.push(t.to); } }); }
      const lost = states.filter(s => !seen.has(s.id)).map(s => s.label);
      if (lost.length) notes.push(h('li', {}, `No se puede llegar desde el inicial a: ${lost.join(', ')}.`));
    }
    if (!states.some(s => s.isFinal)) notes.push(h('li', {}, 'No hay estados finales: no acepta ninguna cadena.'));
    const missing = states.flatMap(s => alphabet.filter(a => !transitions.some(t => t.from === s.id && t.symbol === a)).map(a => `(${s.label}, ${a})`));
    if (missing.length && isDeterministic(transitions)) {
      notes.push(h('li', {}, `δ no está definida para ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}. Es válido (la cadena se rechaza ahí), pero si te piden el AFD completo agrega un estado trampa.`,
        h('div', { class: 'tool-actions' }, h('button', { class: 'btn btn-sm', onclick: () => this.addTrapState() }, 'Completar con estado trampa'))));
    }
    return h('div', { class: 'tool-checks' }, h('h5', {}, 'Revisión'), notes.length ? h('ul', {}, notes) : h('p', { class: 'hint' }, 'Todo en orden: hay inicial, finales, todos los estados son alcanzables y δ está completa.'));
  },

  addTrapState() {
    const s = this.state;
    let name = 'qt';
    for (let i = 1; s.states.some(x => x.label === name); i++) name = `qt${i}`;
    const data = this.serialize();
    const id = Math.max(0, ...s.states.map(x => x.id)) + 1;
    let tid = Math.max(0, ...s.transitions.map(x => x.id)) + 1;
    const maxX = Math.max(...s.states.map(x => x.x));
    const avgY = s.states.reduce((acc, x) => acc + x.y, 0) / s.states.length;
    data.states.push({ id, label: name, x: maxX + 170, y: avgY + 120, isStart: false, isFinal: false });
    for (const st of data.states) {
      for (const a of s.alphabet) {
        if (!data.transitions.some(t => t.from === st.id && t.symbol === a)) data.transitions.push({ id: tid++, from: st.id, to: id, symbol: a });
      }
    }
    this.applyResult(data, `Se agregó el estado trampa ${name}`);
  },

  // ---------- AFND → AFD ----------
  toolSubset() {
    const head = this.intro('AFND → AFD', 'Pasaje con el algoritmo de la cátedra: cada estado del AFD es un conjunto [e1,…,ek] de estados del AFND y δD([…], a) es la unión de δND de cada uno. Solo se generan los conjuntos alcanzables desde [e0].');
    const notice = this.needsAF();
    if (notice) return [...head, notice];
    const r = subsetConstruction(this.state);
    if (r.error) return [...head, h('p', { class: 'form-error' }, r.error)];
    const { alphabet } = r;
    const mark = x => `${x.isStart ? '→' : ''}${x.isFinal ? '*' : ''}`;
    const nd = new Map(r.ndRows.map(x => [x.label, x.cells]));

    const calc = r.rows.flatMap(row => alphabet.map((a, i) => {
      if (!row.set.length) return `δD([], ${a}) = []`;
      const parts = row.set.map(l => `δND(${l}, ${a})`).join(' ∪ ');
      const values = row.set.map(l => fmtSet(nd.get(l)[i])).join(' ∪ ');
      return `δD(${row.name}, ${a}) = ${parts} = ${values} = ${row.next[i]}`;
    }));
    const finals = r.rows.filter(x => x.isFinal).map(x => x.name);
    const tuple = `AFD = <{${r.rows.map(x => x.name).join(', ')}}, {${alphabet.join(', ')}}, δD, ${r.rows[0].name}, {${finals.join(', ')}}>`;
    const data = { type: 'afd', alphabet, ...r.automaton };

    return [
      ...head,
      isDeterministic(this.state.transitions) && h('p', { class: 'tool-notice' }, 'Este autómata ya es determinístico; igual puedes ver cómo queda con el algoritmo.'),
      h('h5', {}, 'δ del AFND'),
      tableEl(['δND', ...alphabet], r.ndRows.map(x => [mark(x) + x.label, ...x.cells.map(fmtSet)])),
      h('h5', {}, 'δ del AFD'),
      tableEl(['δD', ...alphabet], r.rows.map(x => [mark(x) + x.name, ...x.next])),
      h('p', { class: 'hint' }, 'Las filas aparecen en el orden en que se descubre cada conjunto. Son finales los que contienen algún final del AFND. [] es el conjunto vacío (estado trampa).'),
      h('details', { class: 'tool-details' }, h('summary', {}, 'Cómo se calculó cada celda'), h('pre', { class: 'mono-block' }, calc.join('\n'))),
      h('pre', { class: 'tuple' }, tuple),
      h('div', { class: 'tool-actions' },
        h('button', { class: 'btn btn-primary', onclick: () => this.applyResult(data, 'Se dibujó el AFD equivalente') }, 'Dibujar el AFD en el tablero'),
        h('button', { class: 'btn', onclick: () => { this.applyResult(data, 'Se dibujó el AFD equivalente'); this.openTools('minimize'); } }, 'Dibujar y minimizar'),
        this.copyButton('Copiar tablas', () => [tableText(['δND', ...alphabet], r.ndRows.map(x => [mark(x) + x.label, ...x.cells.map(fmtSet)])), '', tableText(['δD', ...alphabet], r.rows.map(x => [mark(x) + x.name, ...x.next])), '', tuple].join('\n')))
    ];
  },

  // ---------- Minimizar ----------
  toolMinimize() {
    const head = this.intro('Minimizar AFD', 'Algoritmo de clase: se eliminan los estados inalcanzables y los muertos, se arma Π0 = {no finales, finales} y se parte cada grupo según a qué grupo va cada símbolo, hasta que Πk+1 = Πk.');
    const notice = this.needsAF();
    if (notice) return [...head, notice];
    const r = minimize(this.state);
    if (r.error) {
      return [...head, h('div', { class: 'tool-notice' }, h('p', {}, r.error),
        h('button', { class: 'btn', onclick: () => this.showTool('subset') }, 'Ir a AFND → AFD'))];
    }
    const { alphabet } = this.state;
    const out = [...head,
      h('h5', {}, '1. Estados inalcanzables'),
      h('p', {}, r.unreachable.length ? `Se eliminan: ${r.unreachable.join(', ')}.` : 'No hay estados inalcanzables desde el inicial.'),
      h('h5', {}, '2. Estados muertos'),
      h('p', {}, r.dead.length ? `Se eliminan (desde ellos no se llega a un final): ${r.dead.join(', ')}.` : 'No hay estados muertos.')];

    if (r.empty) {
      out.push(h('p', { class: 'tool-notice' }, 'El inicial no llega a ningún final: el lenguaje es vacío y el AFD mínimo es un único estado no final.'));
    } else {
      r.steps.forEach((step, i) => {
        const last = i === r.steps.length - 1;
        let prevGroup = null;
        out.push(
          h('h5', {}, `${i + 3}. Partición Π${step.k}`),
          h('p', { class: 'groups' }, step.groups.map(g => h('span', { class: 'group' }, `${g.name} = {${g.states.join(', ')}}`))),
          tableEl(['Estado', 'Grupo', ...alphabet], step.rows.map(x => [x.state, x.group, ...x.targets]), x => {
            const cls = x[1] !== prevGroup && prevGroup !== null ? 'group-start' : '';
            prevGroup = x[1];
            return cls;
          }),
          h('p', { class: 'hint' }, last
            ? `Ningún grupo se parte: Π${step.k + 1} = Π${step.k}, terminar.`
            : `Los estados de un mismo grupo que van a grupos distintos con algún símbolo se separan: así se arma Π${step.k + 1}.`));
      });
    }

    const fd = formalDefinition('afd', r.automaton);
    const groupOf = new Map(r.groups.map(g => [g.name, g.states]));
    const rows = fd.rows.map(row => [...row, fmtSet(groupOf.get(row[0].replace(/^[→*]+/, '')) ?? [])]);
    const original = this.state.states.length;
    const same = !r.empty && r.groups.length === original;
    out.push(
      h('h5', {}, 'AFD mínimo'),
      same && h('p', { class: 'tool-notice' }, 'El AFD ya era mínimo: no se pudo juntar ni eliminar ningún estado.'),
      tableEl([...fd.headers.map(x => (x === 'δ' ? 'δmin' : x)), 'Estados originales'], rows),
      h('pre', { class: 'tuple' }, fd.tuple.replace(/^AFN?D/, 'AFDmin')),
      h('div', { class: 'tool-actions' },
        h('button', { class: 'btn btn-primary', onclick: () => this.applyResult({ type: 'afd', alphabet, ...r.automaton }, `Se dibujó el AFD mínimo (${r.groups.length} estados)`) }, 'Dibujar el AFD mínimo en el tablero'),
        this.copyButton('Copiar desarrollo', () => [
          `Inalcanzables: ${r.unreachable.join(', ') || 'ninguno'}`, `Muertos: ${r.dead.join(', ') || 'ninguno'}`, '',
          ...r.steps.flatMap(s => [`Π${s.k} = { ${s.groups.map(g => `${g.name} = {${g.states.join(', ')}}`).join(', ')} }`, tableText(['Estado', 'Grupo', ...alphabet], s.rows.map(x => [x.state, x.group, ...x.targets])), '']),
          tableText([...fd.headers, 'Estados originales'], rows), fd.tuple
        ].join('\n'))));
    return out;
  },

  // ---------- Gramática regular ----------
  toolGrammar() {
    const out = this.intro('Gramática regular', 'Del autómata a una gramática lineal a derecha con el algoritmo de la cátedra, con derivaciones de cadenas; y de una gramática al autómata.');

    out.push(h('h5', {}, 'Del autómata a la gramática'));
    const notice = this.needsAF();
    if (notice) out.push(notice);
    else {
      const g = afToGrammar(this.state);
      if (g.error) out.push(h('p', { class: 'form-error' }, g.error));
      else {
        const text = `${grammarTuple(g)}\nP:\n${grammarText(g)}`;
        const word = this.keep(h('input', { id: 'deriveInput', class: 'input mono', placeholder: 'cadena a derivar', spellcheck: false }), 'derive', $('testString').value);
        const result = h('p', { class: 'derivation', 'aria-live': 'polite' });
        const derive = () => {
          const w = word.value.trim() === LAMBDA ? '' : word.value.trim();
          const d = derivation(this.state, g, w);
          result.className = d ? 'derivation' : 'derivation form-error';
          result.textContent = d ? d.join(' ⇒ ') : `"${show(w)}" no pertenece al lenguaje: no hay derivación.`;
        };
        word.addEventListener('keydown', e => { if (e.key === 'Enter') derive(); });
        out.push(
          tableEl(['Estado', 'Símbolo(s) asociado(s)'], g.mapping.map(m => [m.state, m.symbols])),
          h('pre', { class: 'tuple' }, grammarTuple(g)),
          h('pre', { class: 'mono-block grammar' }, grammarText(g) || '(sin producciones)'),
          h('div', { class: 'tool-actions' }, this.copyButton('Copiar gramática', () => text)),
          h('div', { class: 'row-inline' }, field('Derivar una cadena', word), h('button', { class: 'btn', onclick: derive }, 'Derivar')),
          result);
      }
    }

    out.push(h('h5', {}, 'De la gramática al autómata'));
    const prods = this.keep(h('textarea', { id: 'grammarInput', class: 'input mono', rows: 5, spellcheck: false, placeholder: 'S → 1B | 1\nA → 1B | 1\nB → 0A' }), 'grammar-in');
    const err = h('p', { class: 'form-error', role: 'alert' });
    const build = () => {
      const r = grammarToAF(prods.value);
      if (r.error) { err.textContent = r.error; return; }
      this.applyResult({ type: 'afd', alphabet: r.alphabet, ...r.automaton },
        r.finalName ? `Se dibujó el AF (${r.finalName} es el estado final agregado)` : 'Se dibujó el AF de la gramática');
    };
    out.push(
      field('Producciones, una regla por línea', prods, 'Lineal a derecha: A → aB, A → a, y S → λ si genera la cadena vacía. Usa | para alternativas. Se agrega un estado final Z para las reglas A → a, y el AF puede quedar no determinístico.'),
      chips(prods, ['→', '|', LAMBDA]),
      err,
      h('div', { class: 'tool-actions' }, h('button', { class: 'btn btn-primary', onclick: build }, 'Dibujar el AF en el tablero')));
    return out;
  },

  // ---------- Expresión regular ----------
  // AF → ER por eliminación de estados, con el detalle de cada paso
  regexFromAF(re) {
    const notice = this.needsAF();
    if (notice) return [notice];
    const r = afToRegex(this.state);
    if (r.error) return [h('p', { class: 'form-error' }, r.error)];

    const stuv = p => ['S', 'U', 'T', 'V'].filter(k => p.stuv[k] !== undefined).map(k => `${k} = ${p.stuv[k]}`).join('   ');
    const detail = r.parts.flatMap(p => [
      `Final ${p.final}:`,
      ...(p.steps.length ? p.steps.map(s => `  Se elimina ${s.state}${s.changes.length ? '\n' + s.changes.map(c => `    ${c}`).join('\n') : ' (no conecta nada)'}`) : ['  No hay estados para eliminar.']),
      `  ${stuv(p)}`,
      `  ER = ${p.regex}`
    ]);
    return [
      h('pre', { class: 'mono-block' }, r.regex),
      h('div', { class: 'tool-actions' },
        this.copyButton('Copiar expresión', () => r.regex),
        h('button', { class: 'btn', onclick: () => { re.value = r.regex; re.dispatchEvent(new Event('input')); re.focus(); } }, 'Usarla abajo para probar cadenas')),
      r.parts.length > 0 && h('details', { class: 'tool-details' }, h('summary', {}, 'Paso a paso (eliminación de estados)'), h('pre', { class: 'mono-block' }, detail.join('\n'))),
      h('p', { class: 'hint' }, 'Por cada estado final se eliminan los demás estados, salvo el inicial: cada camino p → s → q pasa a ser p → q con R(p,s) R(s,s)* R(s,q). Con dos estados queda S*U(T+VS*U)*, y la expresión es la unión de la de cada final.')
    ];
  },

  toolRegex() {
    const re = this.keep(h('input', { id: 'regexInput', class: 'input mono', spellcheck: false, placeholder: '(a + b)*.a.b.b' }), 'regex');
    const err = h('p', { class: 'form-error', role: 'alert' });
    const words = this.keep(h('textarea', { id: 'regexWords', class: 'input mono', rows: 4, spellcheck: false, placeholder: '10100010\n011100' }), 'regex-words');
    const membership = h('div', { class: 'tool-results', 'aria-live': 'polite' });
    const len = this.keep(h('input', { id: 'regexLen', class: 'input mono', type: 'number', min: 0, max: 12 }), 'regex-len', '4');
    const lang = h('div', { class: 'tool-results', 'aria-live': 'polite' });

    const compile = () => {
      err.textContent = '';
      try { return { match: regexMatcher(re.value), ...regexToAF(re.value) }; } catch (e) { err.textContent = e.message; return null; }
    };
    const test = () => {
      const c = compile();
      if (!c) return;
      const items = parseBatch(words.value);
      membership.replaceChildren(h('ul', { class: 'member-list' }, items.map(it => {
        const ok = c.match(it.input);
        return h('li', {}, h('span', { class: `res ${ok ? 'accepted' : 'rejected'}` }, ok ? '∈ L' : '∉ L'), ' ', h('code', {}, show(it.input)));
      })));
    };
    const list = () => {
      const c = compile();
      if (!c) return;
      const sigma = c.alphabet;
      const n = Math.max(0, Math.min(maxLengthFor(Math.max(1, sigma.length), 30000), +len.value || 0));
      len.value = n;
      const found = sigma.length ? [...allStrings(sigma, n)].filter(c.match) : (c.match('') ? [''] : []);
      lang.replaceChildren(found.length
        ? h('div', { class: 'lang-words' }, found.slice(0, 300).map(w => h('span', { class: 'chip word' }, show(w))))
        : h('p', {}, 'Ninguna cadena hasta esa longitud.'));
    };
    const draw = () => {
      const c = compile();
      if (c) this.applyResult({ type: 'afd', alphabet: c.alphabet, ...c.automaton }, 'Se dibujó un AF equivalente a la expresión');
    };
    re.addEventListener('keydown', e => { if (e.key === 'Enter') test(); });

    return [
      ...this.intro('Expresión regular', 'Con la notación de la cátedra: + es unión, . (o nada) concatenación, * clausura, λ la cadena vacía y ∅ el vacío.'),
      h('h5', {}, 'Del autómata a la expresión regular'),
      ...this.regexFromAF(re),
      h('h5', {}, 'De la expresión al autómata'),
      field('Expresión regular', re),
      chips(re, [LAMBDA, '∅', '+', '.', '*', '(', ')']),
      err,
      h('div', { class: 'tool-cols' },
        h('div', {}, field('¿Pertenecen estas cadenas?', words, 'Una por línea; λ es la cadena vacía.'),
          h('div', { class: 'tool-actions' }, h('button', { class: 'btn btn-primary', onclick: test }, 'Probar')), membership),
        h('div', {}, h('div', { class: 'row-inline' }, field('Cadenas del lenguaje hasta longitud', len), h('button', { class: 'btn', onclick: list }, 'Listar')), lang)),
      h('div', { class: 'tool-actions' }, h('button', { class: 'btn', onclick: draw }, 'Dibujar un AF equivalente en el tablero')),
      h('p', { class: 'hint' }, 'El AF sale con un estado por cada símbolo de la expresión (construcción de Glushkov), sin transiciones λ. Puede quedar no determinístico: pásalo a AFD y minimízalo con las otras herramientas.')
    ];
  },

  // ---------- Cargar desde tabla ----------
  toolTable() {
    this._tableType ??= this.state.automatonType;
    const type = this._tableType;
    const fmt = TABLE_FORMATS[type];
    const text = this.keep(h('textarea', { id: 'tableInput', class: 'input mono', rows: 9, spellcheck: false, placeholder: fmt.example }), `table-${type}`);
    const err = h('p', { class: 'form-error', role: 'alert' });
    const z0 = h('input', { id: 'tableZ0', class: 'input mono', value: this.state.initialStackSymbol || 'Z', maxlength: 2 });
    const sigma = h('input', { id: 'tableSigma', class: 'input mono', value: this.state.alphabet.join(', '), placeholder: 'a, b, c, d' });

    const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Tipo de autómata' },
      ['afd', 'apd', 'mt'].map(t => h('button', {
        class: `seg-btn${t === type ? ' active' : ''}`, role: 'radio', 'aria-checked': t === type,
        onclick: () => { this._tableType = t; this.showTool('table'); }
      }, { afd: 'AF', apd: 'Pila (APD)', mt: 'Turing (MT)' }[t])));

    const build = () => {
      err.textContent = '';
      let r;
      if (type === 'afd') r = parseAFTable(text.value);
      else if (type === 'apd') r = parseAPDTable(text.value, z0.value.trim().replace(/Z(0|₀)/, 'Z') || 'Z');
      else r = parseMTTable(text.value, sigma.value.split(',').map(x => x.trim()).filter(Boolean));
      if (r.error) { err.textContent = r.error; return; }
      this.applyResult({ type, alphabet: r.alphabet, stackAlphabet: r.stackAlphabet, initialStackSymbol: r.initialStackSymbol,
        tapeAlphabet: r.tapeAlphabet, tapeCount: r.tapeCount, ...r.automaton }, `Se dibujó el ${TYPE_NAME[type]} de la tabla`);
    };

    return [
      ...this.intro('Desde una tabla δ', 'Para los ejercicios que empiezan con "Dado el siguiente autómata…": escribe o pega la tabla y el diagrama se dibuja solo.'),
      seg,
      field('Tabla', text, fmt.hint),
      chips(text, type === 'afd' ? ['→', '*', '-', '{', '}'] : type === 'apd' ? ['δ', LAMBDA] : ['B', 'I', 'D', 'N']),
      type === 'apd' && field('Símbolo inicial de pila (Z₀)', z0),
      type === 'mt' && field('Alfabeto de entrada', sigma, 'El resto de los símbolos que aparecen en la tabla se toman como auxiliares del alfabeto de cinta.'),
      err,
      h('div', { class: 'tool-actions' },
        h('button', { class: 'btn', onclick: () => { text.value = fmt.example; text.dispatchEvent(new Event('input')); } }, 'Usar un ejemplo de formato'),
        h('button', { class: 'btn btn-primary', onclick: build }, 'Dibujar en el tablero'))
    ];
  }
};
