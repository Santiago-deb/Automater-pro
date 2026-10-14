// Definición formal y tabla δ con la notación de la cátedra, y el camino
// inverso: armar el autómata a partir de una tabla escrita a mano.
// Puro: no toca el DOM.
import { isDeterministic, buildAutomaton, layout } from './af.js';
import { tapeSymbols, BLANK, MOVES } from './mt.js';

const set = items => `{${items.join(', ')}}`;
const startLabel = states => states.find(s => s.isStart)?.label ?? '—';
const finals = states => states.filter(s => s.isFinal).map(s => s.label);

// ---------- Definición formal ----------
// Devuelve { tuple, headers, rows, notes } para mostrar como tabla o copiar.
export function formalDefinition(type, a) {
  const label = id => a.states.find(s => s.id === id)?.label ?? '?';
  const E = set(a.states.map(s => s.label));
  const mark = s => `${s.isStart ? '→' : ''}${s.isFinal ? '*' : ''}${s.label}`;

  if (type === 'afd') {
    const det = isDeterministic(a.transitions);
    const name = det ? 'AFD' : 'AFND';
    const headers = ['δ', ...a.alphabet];
    const rows = a.states.map(s => [mark(s), ...a.alphabet.map(sym => {
      const to = a.transitions.filter(t => t.from === s.id && t.symbol === sym).map(t => label(t.to));
      if (!to.length) return '-';
      return det ? to[0] : set(to);
    })]);
    return {
      tuple: `${name} = <${E}, ${set(a.alphabet)}, δ, ${startLabel(a.states)}, ${set(finals(a.states))}>`,
      signature: det ? 'δ: E × A → E' : 'δ: E × A → P(E)',
      headers, rows,
      notes: '→ marca el estado inicial y * los finales. "-" = δ no definida.'
    };
  }

  if (type === 'apd') {
    const P = set(a.stackAlphabet);
    const headers = ['Estado', 'Entrada', 'Tope', 'Nuevo estado', 'Reemplazo', ...(a.transitions.some(t => t.output) ? ['Salida'] : [])];
    const rows = a.transitions.map(t => [
      label(t.from), t.isEpsilon ? 'ε' : t.symbol, t.stackTop, label(t.to), t.stackReplace === '' ? 'ε' : t.stackReplace,
      ...(headers.length > 5 ? [t.output || ''] : [])
    ]);
    return {
      tuple: `APD = <${E}, ${set(a.alphabet)}, ${P}, δ, ${startLabel(a.states)}, ${a.initialStackSymbol}, ${set(finals(a.states))}>`,
      signature: 'δ: E × (A ∪ {ε}) × P → E × P*',
      headers, rows,
      lines: a.transitions.map(t => `δ(${label(t.from)}, ${t.isEpsilon ? 'ε' : t.symbol}, ${t.stackTop}) = (${label(t.to)}, ${t.stackReplace === '' ? 'ε' : t.stackReplace})${t.output ? ` / ${t.output}` : ''}`),
      notes: 'El primer símbolo del reemplazo queda en el tope de la pila.'
    };
  }

  // MT: estado, lo leído en cada cinta, (nuevo símbolo, movimiento) por cinta y nuevo estado
  const k = a.tapeCount;
  const C = tapeSymbols(a);
  const headers = ['Estado', ...range(k).map(i => `C${i + 1}`), ...range(k).flatMap(i => [`C${i + 1} nuevo`, 'Mov.']), 'Nuevo estado'];
  const ordered = [...a.transitions].sort((x, y) => a.states.findIndex(s => s.id === x.from) - a.states.findIndex(s => s.id === y.from));
  const rows = ordered.map(t => [label(t.from), ...t.reads, ...t.writes.flatMap((w, i) => [w, t.moves[i]]), label(t.to)]);
  return {
    tuple: `MT = <${E}, ${set(a.alphabet)}, ${set(C)}, δ, ${startLabel(a.states)}, ${BLANK}, ${set(finals(a.states))}>`,
    signature: k === 1 ? 'δ: E × C → E × C × {I, D, N}' : `δ: E × C${sup(k)} → E × (C × {I, D, N})${sup(k)}`,
    headers, rows,
    notes: 'I = izquierda, D = derecha, N = no mueve. B es el blanco.'
  };
}

const range = n => Array.from({ length: n }, (_, i) => i);
const sup = n => String(n).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('');

// Tabla alineada en texto plano (para pegar en un .txt o en el código del TP)
export function tableText(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
  const line = cells => cells.map((c, i) => String(c).padEnd(widths[i])).join(' | ').trimEnd();
  return [line(headers), widths.map(w => '-'.repeat(w)).join('-+-'), ...rows.map(line)].join('\n');
}

// ---------- Cargar desde tabla ----------
// Tokens: grupos {…} enteros, o palabras separadas por espacios, | o tabs.
const tokens = line => line.match(/\{[^}]*\}|[^\s|]+/g) ?? [];
const isEmpty = t => t === '-' || t === '—' || t === '∅' || t === '{}';
const lambdaToken = t => t === 'λ' || t === 'ε' || t === 'lambda';

// Líneas "Inicial: e0" y "Finales: e1, e2" (opcionales), y marcas → / -> / * en los estados.
function readMarks(lines) {
  let start = null;
  let fin = [];
  const rest = [];
  for (const line of lines) {
    const m = line.match(/^\s*(inicial|start)\s*[:=]\s*(.+)$/i);
    const f = line.match(/^\s*(finales|final)\s*[:=]\s*(.+)$/i);
    if (m) start = m[2].replace(/[{}]/g, '').trim();
    else if (f) fin = f[2].replace(/[{}]/g, '').split(/[\s,]+/).filter(Boolean);
    else rest.push(line);
  }
  return { start, fin, rest };
}

function stateName(raw) {
  let name = raw;
  let isStart = false;
  let isFinal = false;
  for (;;) {
    if (/^(→|->|>)/.test(name)) { isStart = true; name = name.replace(/^(→|->|>)/, ''); continue; }
    if (name.startsWith('*')) { isFinal = true; name = name.slice(1); continue; }
    if (name.endsWith('*')) { isFinal = true; name = name.slice(0, -1); continue; }
    break;
  }
  return { name, isStart, isFinal };
}

// Registra estados en orden de aparición y aplica las marcas.
function stateRegistry() {
  const rows = [];
  const get = name => {
    let r = rows.find(x => x.name === name);
    if (!r) { r = { name, isStart: false, isFinal: false }; rows.push(r); }
    return r;
  };
  return { rows, get };
}

function finishStates(reg, marks) {
  const { rows } = reg;
  if (!rows.length) return 'No encontré ningún estado.';
  if (marks.start) {
    if (!rows.some(r => r.name === marks.start)) return `El estado inicial "${marks.start}" no aparece en la tabla.`;
    rows.forEach(r => { r.isStart = r.name === marks.start; });
  }
  marks.fin.forEach(n => {
    const r = rows.find(x => x.name === n);
    if (r) r.isFinal = true;
  });
  if (!rows.some(r => r.isStart)) rows[0].isStart = true;
  if (rows.filter(r => r.isStart).length > 1) return 'Hay más de un estado marcado como inicial.';
  return null;
}

// AF: primera línea con los símbolos (puede empezar con δ), después una fila por estado.
//   δ    a      b
//   →p   q      p
//   *q   -      {p,q}
export function parseAFTable(text) {
  const marks = readMarks(text.split('\n').filter(l => l.trim()));
  const lines = marks.rest;
  if (lines.length < 2) return { error: 'Escribe la fila de símbolos y al menos una fila de estados.' };
  let header = tokens(lines[0]);
  if (/^(δ|d|delta)$/i.test(header[0])) header = header.slice(1);
  const alphabet = header;
  if (!alphabet.length) return { error: 'La primera fila tiene que listar los símbolos del alfabeto.' };

  const reg = stateRegistry();
  const edges = [];
  // Primero los estados en el orden de las filas, después los que solo aparecen como destino
  lines.slice(1).forEach(line => reg.get(stateName(tokens(line)[0]).name));
  for (const line of lines.slice(1)) {
    const tk = tokens(line);
    const { name, isStart, isFinal } = stateName(tk[0]);
    const row = reg.get(name);
    row.isStart ||= isStart;
    row.isFinal ||= isFinal;
    const cells = tk.slice(1);
    if (cells.length !== alphabet.length) {
      return { error: `La fila de ${name} tiene ${cells.length} celdas y hay ${alphabet.length} símbolos. Usa "-" para δ no definida.` };
    }
    cells.forEach((cell, i) => {
      if (isEmpty(cell)) return;
      cell.replace(/[{}]/g, '').split(/[\s,]+/).filter(Boolean).forEach(to => {
        reg.get(to);
        edges.push({ from: name, to, symbol: alphabet[i] });
      });
    });
  }
  const err = finishStates(reg, marks);
  if (err) return { error: err };
  return { type: 'afd', alphabet, automaton: buildAutomaton(reg.rows, edges, alphabet) };
}

// APD: una transición por línea, como "δ(e0, a, Z) = (e1, AZ)" o "e0 a Z e1 AZ".
export function parseAPDTable(text, z0 = 'Z') {
  const marks = readMarks(text.split('\n').filter(l => l.trim()));
  const reg = stateRegistry();
  const list = [];
  for (const line of marks.rest) {
    let parts;
    const m = line.match(/\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)\s*=\s*\(\s*([^,]+?)\s*,\s*([^)]*?)\s*\)\s*(?:\/\s*(\S+))?/);
    if (m) parts = m.slice(1, 7);
    else {
      parts = tokens(line);
      if (parts.length < 5) return { error: `No entiendo la línea "${line.trim()}". Usa δ(e0, a, Z) = (e1, AZ) o e0 a Z e1 AZ.` };
    }
    const [fromRaw, input, top, toRaw, replace, output] = parts.map(p => p?.trim());
    const from = stateName(fromRaw);
    const to = stateName(toRaw);
    Object.assign(reg.get(from.name), { isStart: reg.get(from.name).isStart || from.isStart, isFinal: reg.get(from.name).isFinal || from.isFinal });
    Object.assign(reg.get(to.name), { isFinal: reg.get(to.name).isFinal || to.isFinal });
    // La app usa un carácter por símbolo de pila: Z0 / Z₀ pasa a ser Z
    const norm = s => s.replace(/Z(0|₀)/g, 'Z');
    list.push({
      from: from.name, to: to.name,
      symbol: lambdaToken(input) ? '' : input,
      stackTop: norm(top),
      stackReplace: lambdaToken(replace) || replace === '' ? '' : norm(replace),
      output: output || null
    });
  }
  if (!list.length) return { error: 'No encontré transiciones.' };
  const err = finishStates(reg, marks);
  if (err) return { error: err };

  const multi = list.find(t => t.stackTop.length !== 1);
  if (multi) return { error: `El tope "${multi.stackTop}" tiene más de un carácter: usa un símbolo de pila de un solo carácter.` };
  const alphabet = [...new Set(list.map(t => t.symbol).filter(Boolean))];
  const stackAlphabet = [...new Set(list.flatMap(t => [t.stackTop, ...t.stackReplace.split('')]))];
  const initialStackSymbol = stackAlphabet.includes(z0) ? z0 : list[0].stackTop;
  const base = buildAutomaton(reg.rows, [], alphabet);
  const id = name => base.states.find(s => s.label === name).id;
  base.transitions = list.map((t, i) => ({
    id: i + 1, from: id(t.from), to: id(t.to), symbol: t.symbol, isEpsilon: t.symbol === '',
    stackTop: t.stackTop, stackReplace: t.stackReplace, output: t.output
  }));
  layout(base);
  return { type: 'apd', alphabet, stackAlphabet, initialStackSymbol, automaton: base };
}

// MT: una fila por transición:
//   estado  C1..Ck leídos  (nuevo, mov) por cinta  nuevo estado
//   e0      a  B           a N   X D               e1
// Filas como "e5 - - - - - - -" solo declaran el estado.
export function parseMTTable(text, inputAlphabet) {
  const marks = readMarks(text.split('\n').filter(l => l.trim()));
  const reg = stateRegistry();
  const list = [];
  let k = null;
  marks.rest.forEach(line => { const tk = tokens(line); if (tk.length) reg.get(stateName(tk[0]).name); });
  for (const line of marks.rest) {
    const tk = tokens(line);
    if (!tk.length || /^(estado|e|δ)$/i.test(tk[0]) && tk.some(t => /^C\d/i.test(t))) continue; // encabezado
    const from = stateName(tk[0]);
    const r = reg.get(from.name);
    r.isStart ||= from.isStart;
    r.isFinal ||= from.isFinal;
    if (tk.slice(1).every(isEmpty)) continue;
    if ((tk.length - 2) % 3 !== 0) {
      return { error: `La fila "${line.trim()}" tiene ${tk.length} columnas: con k cintas tienen que ser 3k + 2 (estado, k leídos, k pares nuevo/mov., nuevo estado).` };
    }
    const kk = (tk.length - 2) / 3;
    if (k !== null && kk !== k) return { error: `Las filas tienen distinta cantidad de cintas (${k} y ${kk}).` };
    k = kk;
    const reads = tk.slice(1, 1 + k);
    const pairs = tk.slice(1 + k, 1 + 3 * k);
    const writes = pairs.filter((_, i) => i % 2 === 0);
    const moves = pairs.filter((_, i) => i % 2 === 1).map(m => m.toUpperCase());
    const bad = moves.find(m => !MOVES.includes(m));
    if (bad) return { error: `"${bad}" no es un movimiento válido en "${line.trim()}": usa I, D o N.` };
    const to = stateName(tk.at(-1));
    reg.get(to.name).isFinal ||= to.isFinal;
    list.push({ from: from.name, to: to.name, reads, writes, moves });
  }
  if (!list.length) return { error: 'No encontré transiciones.' };
  if (k > 4) return { error: `La tabla usa ${k} cintas y el simulador admite hasta 4.` };
  const err = finishStates(reg, marks);
  if (err) return { error: err };

  const used = [...new Set(list.flatMap(t => [...t.reads, ...t.writes]))].filter(c => c !== BLANK);
  const alphabet = inputAlphabet?.length ? inputAlphabet.filter(c => c !== BLANK) : [...new Set(list.map(t => t.reads[0]))].filter(c => c !== BLANK);
  const tapeAlphabet = used.filter(c => !alphabet.includes(c));
  const base = buildAutomaton(reg.rows, [], alphabet);
  const id = name => base.states.find(s => s.label === name).id;
  base.transitions = list.map((t, i) => ({ id: i + 1, from: id(t.from), to: id(t.to), reads: t.reads, writes: t.writes, moves: t.moves }));
  layout(base);
  return { type: 'mt', alphabet, tapeAlphabet, tapeCount: k, automaton: base };
}

// ---------- Varias cadenas ----------
// Líneas: una cadena por línea; "+" adelante = debería aceptarse, "-" = rechazarse.
// λ, ε o "lambda" representan la cadena vacía.
export function parseBatch(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    let expect = null;
    let s = line;
    if (/^[+✓]/.test(s)) { expect = 'accepted'; s = s.slice(1).trim(); }
    else if (/^[-✗]/.test(s)) { expect = 'rejected'; s = s.slice(1).trim(); }
    if (lambdaToken(s)) s = '';
    return { input: s, expect };
  });
}
