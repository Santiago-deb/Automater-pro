// Autómatas finitos: AFND, pasaje AFND → AFD, minimización y armado de
// diagramas. Teoría de la cátedra (UNCPBA).
// Puro: no toca el DOM. Un autómata es { states, transitions, alphabet } con
// states = [{ id, label, isStart, isFinal, x?, y? }] y transitions = [{ id, from, to, symbol }].
import { simulateAFD } from './afd.js';

const startOf = states => states.find(s => s.isStart);
const labelOf = states => id => states.find(s => s.id === id)?.label ?? '?';

// δ es función si ningún (estado, símbolo) tiene dos destinos.
export function isDeterministic(transitions) {
  const seen = new Set();
  for (const t of transitions) {
    const k = `${t.from}\u0000${t.symbol}`;
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

// δND: estado → símbolo → [destinos]
function deltaND(transitions) {
  const d = new Map();
  for (const t of transitions) {
    if (!d.has(t.from)) d.set(t.from, new Map());
    const row = d.get(t.from);
    if (!row.has(t.symbol)) row.set(t.symbol, []);
    if (!row.get(t.symbol).includes(t.to)) row.get(t.symbol).push(t.to);
  }
  return d;
}

// AFND: acepta si algún camino termina en un estado final. Cada paso del trace
// lleva el conjunto de estados activos (state: [ids]) y las transiciones usadas.
export function simulateAFND({ states, transitions, alphabet }, input) {
  const start = startOf(states);
  const label = labelOf(states);
  if (!start) return { result: 'warning', msg: '⚠ Define un estado inicial', trace: [] };
  if (alphabet.length === 0) return { result: 'warning', msg: '⚠ Define el alfabeto primero', trace: [] };
  for (const ch of input) {
    if (!alphabet.includes(ch)) return { result: 'rejected', msg: `✗ "${ch}" no pertenece al alfabeto`, trace: [], highlight: start.id };
  }

  let current = [start.id];
  const trace = [{ state: current, symbol: null }];
  const setLabel = ids => `{${ids.map(label).join(', ')}}`;

  for (const ch of input) {
    const used = transitions.filter(t => current.includes(t.from) && t.symbol === ch);
    const next = [...new Set(used.map(t => t.to))];
    if (next.length === 0) {
      return { result: 'rejected', msg: `✗ Ningún camino sigue con "${ch}" desde ${setLabel(current)}`, trace };
    }
    current = next;
    trace.push({ state: current, symbol: ch, transitionId: used.map(t => t.id) });
  }

  const finals = current.filter(id => states.find(s => s.id === id).isFinal);
  return finals.length
    ? { result: 'accepted', msg: `✓ Cadena aceptada · algún camino llega a ${finals.map(label).join(', ')}`, trace }
    : { result: 'rejected', msg: `✗ Ningún camino termina en un estado final: ${setLabel(current)}`, trace };
}

// El modo AF usa el simulador determinístico mientras δ sea función.
export function simulateAF(automaton, input) {
  return isDeterministic(automaton.transitions) ? simulateAFD(automaton, input) : simulateAFND(automaton, input);
}

// Arma un autómata nuevo a partir de nombres de estados y transiciones por nombre.
// rows = [{ name, isStart, isFinal }], edges = [{ from, to, symbol }] (por nombre)
export function buildAutomaton(rows, edges, alphabet) {
  const ids = new Map(rows.map((r, i) => [r.name, i + 1]));
  const states = rows.map((r, i) => ({ id: i + 1, label: r.name, isStart: !!r.isStart, isFinal: !!r.isFinal, x: 0, y: 0 }));
  const transitions = edges.map((e, i) => ({ id: i + 1, from: ids.get(e.from), to: ids.get(e.to), symbol: e.symbol }));
  return layout({ states, transitions, alphabet });
}

// Ubica los estados por capas según la distancia al inicial (de izquierda a derecha).
export function layout(automaton) {
  const { states, transitions } = automaton;
  // Separación según el rótulo más largo (los de MT son anchos: "a,B/<a,N><X,D>")
  const longest = Math.max(1, ...transitions.map(t =>
    t.reads ? t.reads.length * 2 + t.writes.length * 6 : t.stackTop ? 9 + (t.output?.length ?? 0) : 3));
  const gapX = Math.max(170, longest * 7 + 110);
  const gapY = Math.max(130, 90 + longest * 3);
  const start = startOf(states) || states[0];
  const depth = new Map();
  if (start) {
    depth.set(start.id, 0);
    const queue = [start.id];
    while (queue.length) {
      const id = queue.shift();
      for (const t of transitions) {
        if (t.from === id && !depth.has(t.to)) { depth.set(t.to, depth.get(id) + 1); queue.push(t.to); }
      }
    }
  }
  const maxDepth = Math.max(0, ...depth.values());
  states.forEach(s => { if (!depth.has(s.id)) depth.set(s.id, maxDepth + 1); });

  const layers = new Map();
  states.forEach(s => {
    const d = depth.get(s.id);
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d).push(s);
  });
  for (const [d, layer] of layers) {
    layer.forEach((s, i) => {
      // Escalonado: así la arista entre dos estados de la misma capa no cae sobre un bucle
      s.x = d * gapX + (layer.length > 1 && i % 2 ? gapX * 0.3 : 0);
      s.y = (i - (layer.length - 1) / 2) * gapY;
    });
  }
  return automaton;
}

// ---------- AFND → AFD (construcción de subconjuntos) ----------
// Solo se generan los subconjuntos alcanzables desde [e0], como en la práctica.
// Devuelve la tabla δND, las filas de δD en orden de descubrimiento y el AFD.
export function subsetConstruction({ states, transitions, alphabet }) {
  const start = startOf(states);
  if (!start) return { error: 'Define un estado inicial.' };
  if (!alphabet.length) return { error: 'Define el alfabeto.' };

  const label = labelOf(states);
  const order = new Map(states.map((s, i) => [s.id, i]));
  const sort = ids => [...new Set(ids)].sort((a, b) => order.get(a) - order.get(b));
  const name = ids => `[${ids.map(label).join(',')}]`;
  const d = deltaND(transitions);
  const isFinal = ids => ids.some(id => states.find(s => s.id === id).isFinal);

  const ndRows = states.map(s => ({
    label: label(s.id), isStart: s.isStart, isFinal: s.isFinal,
    cells: alphabet.map(a => sort(d.get(s.id)?.get(a) ?? []).map(label))
  }));

  const rows = [];
  const seen = new Set();
  const queue = [[start.id]];
  seen.add(name(queue[0]));
  while (queue.length) {
    const set = queue.shift();
    const next = alphabet.map(a => sort(set.flatMap(id => d.get(id)?.get(a) ?? [])));
    rows.push({ name: name(set), set: set.map(label), isStart: rows.length === 0, isFinal: isFinal(set), next: next.map(name) });
    next.forEach(n => {
      if (!seen.has(name(n))) { seen.add(name(n)); queue.push(n); }
    });
  }

  const edges = rows.flatMap(r => alphabet.map((a, i) => ({ from: r.name, to: r.next[i], symbol: a })));
  return { ndRows, rows, alphabet, automaton: buildAutomaton(rows, edges, alphabet) };
}

// ---------- Minimización ----------
// 1) quita inalcanzables, 2) quita muertos, 3) Π0 = {no finales, finales},
// 5) parte cada grupo según a qué grupo de Πk va cada símbolo, hasta que Πk+1 = Πk.
export function minimize({ states, transitions, alphabet }) {
  const start = startOf(states);
  if (!start) return { error: 'Define un estado inicial.' };
  if (!isDeterministic(transitions)) return { error: 'El autómata es no determinístico: primero pásalo a AFD.' };
  const label = labelOf(states);
  const delta = (id, a) => transitions.find(t => t.from === id && t.symbol === a)?.to;

  // 1) Alcanzables desde el inicial
  const reachable = new Set([start.id]);
  const queue = [start.id];
  while (queue.length) {
    const id = queue.shift();
    for (const t of transitions) if (t.from === id && !reachable.has(t.to)) { reachable.add(t.to); queue.push(t.to); }
  }
  const unreachable = states.filter(s => !reachable.has(s.id)).map(s => s.label);

  // 2) Vivos: los que alcanzan algún final (búsqueda hacia atrás)
  const alive = new Set(states.filter(s => s.isFinal && reachable.has(s.id)).map(s => s.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of transitions) {
      if (reachable.has(t.from) && alive.has(t.to) && !alive.has(t.from)) { alive.add(t.from); grew = true; }
    }
  }
  const dead = states.filter(s => reachable.has(s.id) && !alive.has(s.id)).map(s => s.label);

  if (!alive.has(start.id)) {
    const automaton = buildAutomaton([{ name: 'p0', isStart: true }], [], alphabet);
    return { unreachable, dead, steps: [], groups: [], automaton, empty: true };
  }

  const kept = states.filter(s => alive.has(s.id));
  // Las transiciones hacia estados eliminados quedan indefinidas (-)
  const target = (id, a) => { const to = delta(id, a); return alive.has(to) ? to : undefined; };

  let partition = [kept.filter(s => !s.isFinal).map(s => s.id), kept.filter(s => s.isFinal).map(s => s.id)].filter(g => g.length);
  const steps = [];
  for (let k = 0; ; k++) {
    const groupName = i => `G${k}${i + 1}`;
    const groupOf = new Map();
    partition.forEach((g, i) => g.forEach(id => groupOf.set(id, i)));

    const next = [];
    const rows = [];
    partition.forEach((group, gi) => {
      const buckets = new Map();
      group.forEach(id => {
        const sig = alphabet.map(a => { const to = target(id, a); return to === undefined ? '-' : groupName(groupOf.get(to)); });
        rows.push({ state: label(id), group: groupName(gi), targets: sig });
        const key = sig.join('|');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(id);
      });
      next.push(...buckets.values());
    });

    steps.push({ k, groups: partition.map((g, i) => ({ name: groupName(i), states: g.map(label) })), rows });
    if (next.length === partition.length) break;
    partition = next;
  }

  // Resultado: p0 es el grupo del inicial, el resto en orden
  const startGroup = partition.findIndex(g => g.includes(start.id));
  const ordered = [partition[startGroup], ...partition.filter((_, i) => i !== startGroup)];
  const pName = new Map();
  ordered.forEach((g, i) => g.forEach(id => pName.set(id, `p${i}`)));
  const rowsOut = ordered.map((g, i) => ({
    name: `p${i}`, states: g.map(label), isStart: i === 0, isFinal: states.find(s => s.id === g[0]).isFinal
  }));
  const edges = [];
  ordered.forEach((g, i) => alphabet.forEach(a => {
    const to = target(g[0], a);
    if (to !== undefined) edges.push({ from: `p${i}`, to: pName.get(to), symbol: a });
  }));
  return { unreachable, dead, steps, groups: rowsOut, automaton: buildAutomaton(rowsOut, edges, alphabet) };
}

// ---------- Exploración del lenguaje ----------
// Todas las cadenas sobre Σ de longitud ≤ maxLen (en orden), hasta `limit` en total.
export function* allStrings(alphabet, maxLen) {
  yield '';
  let level = [''];
  for (let n = 1; n <= maxLen; n++) {
    const next = [];
    for (const w of level) for (const a of alphabet) { next.push(w + a); }
    for (const w of next) yield w;
    level = next;
  }
}

// Cuántas cadenas hay de longitud ≤ n sobre un alfabeto de k símbolos.
export const countStrings = (k, n) => (k === 1 ? n + 1 : (k ** (n + 1) - 1) / (k - 1));

// Mayor longitud n tal que se prueban como mucho `limit` cadenas.
export function maxLengthFor(k, limit) {
  let n = 0;
  while (countStrings(k, n + 1) <= limit && n < 30) n++;
  return n;
}
