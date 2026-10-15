// Gramáticas regulares y expresiones regulares (teoría de la cátedra, UNCPBA).
// - AF → GR lineal a derecha con el algoritmo de la cátedra, y derivaciones.
// - GR lineal a derecha → AF (puede salir AFND).
// - ER con la notación de la cátedra (+ unión, . o yuxtaposición concatenación,
//   * clausura, λ cadena vacía, ∅ vacío) → AF sin λ-transiciones (Glushkov).
// Puro: no toca el DOM.
import { buildAutomaton } from './af.js';

export const LAMBDA = 'λ';
const isLambda = s => s === 'λ' || s === 'ε';

// ---------- AF → GR ----------
// 1) S al inicial. 2) Un no terminal a cada estado, salvo finales sin arcos de
//    salida; el inicial lleva otro además de S si le llegan arcos.
// 3) δ(ei, a) = ej da A → aB, y también A → a si ej es final (usando el no
//    terminal de ej, nunca S). 4) Si el inicial es final, S → λ.
export function afToGrammar({ states, transitions, alphabet }) {
  const start = states.find(s => s.isStart);
  if (!start) return { error: 'Define un estado inicial.' };

  const hasOut = id => transitions.some(t => t.from === id);
  const hasIn = id => transitions.some(t => t.to === id);
  const letters = 'ABCDEFGHIJKLMNOPQRTUVWXYZ'.split(''); // sin S
  let next = 0;
  const fresh = () => (next < letters.length ? letters[next++] : `N${next++ - letters.length + 1}`);

  const nt = new Map(); // estado → no terminal (para usar a la derecha)
  const lhs = new Map(); // estado → no terminales que lo representan a la izquierda
  for (const s of states) {
    if (s.id === start.id) {
      lhs.set(s.id, ['S']);
      if (hasIn(s.id)) { const n = fresh(); nt.set(s.id, n); lhs.get(s.id).push(n); }
    } else if (hasOut(s.id) || !s.isFinal) {
      const n = fresh();
      nt.set(s.id, n);
      lhs.set(s.id, [n]);
    }
  }

  const productions = [];
  const add = (left, right) => {
    if (!productions.some(p => p.left === left && p.right === right)) productions.push({ left, right });
  };
  if (start.isFinal) add('S', LAMBDA);
  for (const s of states) {
    for (const t of transitions.filter(t => t.from === s.id)) {
      const to = states.find(x => x.id === t.to);
      for (const left of lhs.get(s.id) ?? []) {
        if (nt.has(to.id)) add(left, t.symbol + nt.get(to.id));
        if (to.isFinal) add(left, t.symbol);
      }
    }
  }

  const nonTerminals = [...new Set([...lhs.values()].flat().filter(n => n !== 'S'))];
  const usedRight = new Set(productions.map(p => p.right.slice(1)).filter(Boolean));
  // Un no terminal que no aparece nunca a la izquierda no genera nada: se omite
  const leftSet = new Set(productions.map(p => p.left));
  const N = nonTerminals.filter(n => leftSet.has(n) || usedRight.has(n));
  const mapping = states.map(s => ({ state: s.label, symbols: (lhs.get(s.id) ?? []).join(', ') || '—' }));

  return { N, T: alphabet, productions, mapping, nt, lhs };
}

// Agrupa las producciones por lado izquierdo: "S → aA | a"
export function grammarText(g) {
  const order = ['S', ...g.N];
  return order
    .filter(n => g.productions.some(p => p.left === n))
    .map(n => `${n} → ${g.productions.filter(p => p.left === n).map(p => p.right).join(' | ')}`)
    .join('\n');
}

export function grammarTuple(g) {
  return `G = <{${g.N.join(', ')}}, {${g.T.join(', ')}}, P, S>`;
}

// Derivación de `input` siguiendo un camino de aceptación del autómata:
// S ⇒ aA ⇒ abB ⇒ … ⇒ w. Devuelve null si la cadena no es aceptada.
export function derivation({ states, transitions }, g, input) {
  const start = states.find(s => s.isStart);
  if (!start) return null;
  if (input === '') return start.isFinal ? ['S', LAMBDA] : null;

  // BFS sobre (estado, posición) para encontrar un camino (sirve para AFND)
  const key = (id, i) => `${id}:${i}`;
  const parent = new Map([[key(start.id, 0), null]]);
  let queue = [start.id];
  for (let i = 0; i < input.length; i++) {
    const next = [];
    for (const id of queue) {
      for (const t of transitions) {
        if (t.from === id && t.symbol === input[i] && !parent.has(key(t.to, i + 1))) {
          parent.set(key(t.to, i + 1), id);
          next.push(t.to);
        }
      }
    }
    queue = next;
  }
  const end = queue.find(id => states.find(s => s.id === id).isFinal);
  if (end === undefined) return null;

  const path = [end];
  for (let i = input.length; i > 0; i--) path.unshift(parent.get(key(path[0], i)));

  // Forma sentencial i: prefijo de i símbolos + no terminal del estado i
  const forms = ['S'];
  for (let i = 1; i < input.length; i++) forms.push(input.slice(0, i) + g.nt.get(path[i]));
  forms.push(input);
  return forms;
}

// ---------- GR → AF ----------
// Producciones lineales a derecha: A → aB, A → a, S → λ. Cada no terminal es un
// estado (S el inicial) y se agrega un estado final nuevo para las A → a.
export function grammarToAF(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { error: 'Escribe al menos una producción.' };

  const prods = [];
  for (const line of lines) {
    const m = line.match(/^([A-Z][0-9']*)\s*(?:→|->|::=|=>?)\s*(.+)$/);
    if (!m) return { error: `No entiendo la línea "${line}". Usa el formato A → aB | a.` };
    for (const alt of m[2].split('|').map(s => s.trim()).filter(Boolean)) {
      const rhs = alt.replace(/\s+/g, '');
      if (isLambda(rhs)) { prods.push({ left: m[1], symbol: null, to: null }); continue; }
      const r = rhs.match(/^([^A-Z|λε])([A-Z][0-9']*)?$/);
      if (!r) return { error: `"${m[1]} → ${alt}" no es lineal a derecha (debe ser a, aB o λ).` };
      prods.push({ left: m[1], symbol: r[1], to: r[2] ?? null });
    }
  }
  if (!prods.some(p => p.left === 'S')) return { error: 'Falta el símbolo distinguido S.' };
  const lambdaBad = prods.find(p => p.symbol === null && p.left !== 'S');
  if (lambdaBad) return { error: `Solo S puede producir λ (aparece ${lambdaBad.left} → λ).` };

  const nts = ['S', ...new Set(prods.flatMap(p => [p.left, p.to]).filter(n => n && n !== 'S'))];
  let finalName = 'Z';
  for (let i = 1; nts.includes(finalName); i++) finalName = `F${i}`;
  const needsFinal = prods.some(p => p.symbol !== null && p.to === null);

  const rows = nts.map(n => ({ name: n, isStart: n === 'S', isFinal: n === 'S' && prods.some(p => p.left === 'S' && p.symbol === null) }));
  if (needsFinal) rows.push({ name: finalName, isFinal: true });
  const edges = prods.filter(p => p.symbol !== null).map(p => ({ from: p.left, to: p.to ?? finalName, symbol: p.symbol }));
  const alphabet = [...new Set(edges.map(e => e.symbol))];
  const dedup = edges.filter((e, i) => edges.findIndex(o => o.from === e.from && o.to === e.to && o.symbol === e.symbol) === i);
  return { automaton: buildAutomaton(rows, dedup, alphabet), alphabet, finalName: needsFinal ? finalName : null };
}

// ---------- Expresiones regulares ----------
// Gramática: union := concat ('+' concat)* ; concat := star ('.'? star)* ;
// star := atom '*'* ; atom := símbolo | λ | ∅ | '(' union ')'
export function parseRegex(src) {
  const s = src.replace(/\s+/g, '');
  if (!s) throw new Error('La expresión está vacía.');
  let i = 0;
  const peek = () => s[i];
  const atomStart = c => c !== undefined && !'+.*)'.includes(c);

  function union() {
    let node = concat();
    while (peek() === '+') { i++; node = { op: '+', a: node, b: concat() }; }
    return node;
  }
  function concat() {
    let node = star();
    while (peek() === '.' || atomStart(peek())) {
      if (peek() === '.') i++;
      node = { op: '.', a: node, b: star() };
    }
    return node;
  }
  function star() {
    let node = atom();
    while (peek() === '*') { i++; node = { op: '*', a: node }; }
    return node;
  }
  function atom() {
    const c = peek();
    if (c === undefined) throw new Error('La expresión termina de golpe: falta un operando.');
    if (c === '(') {
      i++;
      const node = union();
      if (peek() !== ')') throw new Error(`Falta cerrar un paréntesis (posición ${i + 1}).`);
      i++;
      return node;
    }
    if ('+.*)'.includes(c)) throw new Error(`"${c}" fuera de lugar en la posición ${i + 1}.`);
    i++;
    if (isLambda(c)) return { op: 'λ' };
    if (c === '∅') return { op: '∅' };
    return { op: 'sym', c };
  }

  const tree = union();
  if (i < s.length) throw new Error(`"${s[i]}" fuera de lugar en la posición ${i + 1}.`);
  return tree;
}

// Construcción de Glushkov: un estado por cada aparición de símbolo, más el inicial.
export function regexToAF(src) {
  const tree = parseRegex(src);
  const symbols = [];
  const follow = [];

  // Devuelve { nullable, first, last } y va llenando follow
  function walk(n) {
    switch (n.op) {
      case 'λ': return { nullable: true, first: [], last: [] };
      case '∅': return { nullable: false, first: [], last: [] };
      case 'sym': {
        const p = symbols.push(n.c) - 1;
        follow[p] = new Set();
        return { nullable: false, first: [p], last: [p] };
      }
      case '+': {
        const a = walk(n.a), b = walk(n.b);
        return { nullable: a.nullable || b.nullable, first: [...a.first, ...b.first], last: [...a.last, ...b.last] };
      }
      case '.': {
        const a = walk(n.a), b = walk(n.b);
        a.last.forEach(p => b.first.forEach(q => follow[p].add(q)));
        return {
          nullable: a.nullable && b.nullable,
          first: a.nullable ? [...a.first, ...b.first] : a.first,
          last: b.nullable ? [...a.last, ...b.last] : b.last
        };
      }
      case '*': {
        const a = walk(n.a);
        a.last.forEach(p => a.first.forEach(q => follow[p].add(q)));
        return { nullable: true, first: a.first, last: a.last };
      }
    }
  }
  const { nullable, first, last } = walk(tree);

  const alphabet = [...new Set(symbols)];
  const name = p => `q${p + 1}`;
  const rows = [{ name: 'q0', isStart: true, isFinal: nullable }, ...symbols.map((_, p) => ({ name: name(p), isFinal: last.includes(p) }))];
  const edges = [
    ...first.map(p => ({ from: 'q0', to: name(p), symbol: symbols[p] })),
    ...symbols.flatMap((_, p) => [...follow[p]].map(q => ({ from: name(p), to: name(q), symbol: symbols[q] })))
  ];
  return { automaton: buildAutomaton(rows, edges, alphabet), alphabet };
}

// ---------- AF → ER (eliminación de estados) ----------
// Misma lógica que MTSolution (tesis de M. Martínez, UNCPBA), reescrita:
// 1) Por cada final f se deja a f como único final.
// 2) Se elimina cada estado s que no es ni el inicial ni f:
//    R(p,q) := R(p,q) + R(p,s) R(s,s)* R(s,q) para cada predecesor p y sucesor q.
// 3) Quedan i y f: S = R(i,i), U = R(i,f), T = R(f,f), V = R(f,i) y
//    ER_f = S*U(T+VS*U)*; si el inicial es f, ER_f = S*.
// 4) La ER es la unión de las ER_f.
// Las expresiones se simplifican con ∅ y λ para que no crezcan de más.
const EMPTY = { op: '∅' };
const EPS = { op: 'λ' };
const sameRe = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const altsOf = n => (n.op === '+' ? [...altsOf(n.a), ...altsOf(n.b)] : [n]);

function alt(a, b) {
  if (a.op === '∅') return b;
  if (b.op === '∅') return a;
  if (altsOf(a).some(x => sameRe(x, b))) return a;
  return { op: '+', a, b };
}
function cat(a, b) {
  if (a.op === '∅' || b.op === '∅') return EMPTY;
  if (a.op === 'λ') return b;
  if (b.op === 'λ') return a;
  return { op: '.', a, b };
}
function star(a) {
  if (a.op === '∅' || a.op === 'λ') return EPS;
  if (a.op === '*') return a;
  // (λ + x)* = x*
  const rest = altsOf(a).filter(x => x.op !== 'λ');
  if (rest.length < altsOf(a).length) return star(rest.reduce(alt, EMPTY));
  return { op: '*', a };
}

// Notación de la cátedra: + unión, yuxtaposición (o . si hay símbolos de más de
// un carácter), * clausura.
export function regexText(n, dot = false) {
  const wrap = (x, cond) => (cond ? `(${regexText(x, dot)})` : regexText(x, dot));
  switch (n.op) {
    case '∅': return '∅';
    case 'λ': return LAMBDA;
    case 'sym': return n.c;
    case '+': return `${regexText(n.a, dot)} + ${regexText(n.b, dot)}`;
    case '.': return wrap(n.a, n.a.op === '+') + (dot ? '.' : '') + wrap(n.b, n.b.op === '+');
    case '*': return `${wrap(n.a, n.a.op !== 'sym' || n.a.c.length > 1)}*`;
  }
}

export function afToRegex({ states, transitions, alphabet }) {
  const start = states.find(s => s.isStart);
  if (!start) return { error: 'Define un estado inicial.' };
  const finals = states.filter(s => s.isFinal);
  if (!finals.length) return { error: 'Marca al menos un estado final.' };

  const dot = alphabet.some(a => a.length > 1);
  const label = id => states.find(s => s.id === id).label;
  const show = n => regexText(n, dot);
  const reach = (from, edges) => {
    const seen = new Set([from]);
    const stack = [from];
    while (stack.length) {
      const id = stack.pop();
      for (const [a, b] of edges) if (a === id && !seen.has(b)) { seen.add(b); stack.push(b); }
    }
    return seen;
  };
  const pairs = transitions.map(t => [t.from, t.to]);
  const fromStart = reach(start.id, pairs);

  const parts = [];
  for (const f of finals) {
    if (!fromStart.has(f.id)) continue;
    // Solo importan los estados en algún camino del inicial a f
    const toF = reach(f.id, pairs.map(([a, b]) => [b, a]));
    const useful = states.filter(s => fromStart.has(s.id) && toF.has(s.id)).map(s => s.id);

    const R = new Map(); // "p q" → expresión
    const key = (p, q) => `${p} ${q}`;
    const get = (p, q) => R.get(key(p, q)) ?? EMPTY;
    for (const t of transitions) {
      if (useful.includes(t.from) && useful.includes(t.to)) {
        R.set(key(t.from, t.to), alt(get(t.from, t.to), { op: 'sym', c: t.symbol }));
      }
    }

    const steps = [];
    let alive = [...useful];
    for (const s of useful.filter(id => id !== start.id && id !== f.id)) {
      alive = alive.filter(id => id !== s);
      const loop = star(get(s, s));
      const changes = [];
      for (const p of alive) {
        if (get(p, s).op === '∅') continue;
        for (const q of alive) {
          if (get(s, q).op === '∅') continue;
          const via = cat(cat(get(p, s), loop), get(s, q));
          R.set(key(p, q), alt(get(p, q), via));
          changes.push(`${label(p)} → ${label(q)}: ${show(get(p, q))}`);
        }
      }
      for (const id of useful) { R.delete(key(id, s)); R.delete(key(s, id)); }
      steps.push({ state: label(s), changes });
    }

    const S = get(start.id, start.id);
    let er, stuv;
    if (f.id === start.id) {
      er = star(S);
      stuv = { S: show(S) };
    } else {
      const U = get(start.id, f.id), T = get(f.id, f.id), V = get(f.id, start.id);
      const Ss = star(S);
      er = cat(cat(Ss, U), star(alt(T, cat(cat(V, Ss), U))));
      stuv = { S: show(S), U: show(U), T: show(T), V: show(V) };
    }
    parts.push({ final: f.label, steps, stuv, regex: show(er), tree: er });
  }

  const tree = parts.map(p => p.tree).reduce(alt, EMPTY);
  return { regex: show(tree), parts: parts.map(({ tree, ...p }) => p) };
}

// Pertenencia de una cadena a L(ER) simulando el autómata de Glushkov.
export function regexMatcher(src) {
  const { automaton } = regexToAF(src);
  const { states, transitions } = automaton;
  return input => {
    let current = new Set([states.find(s => s.isStart).id]);
    for (const ch of input) {
      const next = new Set();
      for (const t of transitions) if (current.has(t.from) && t.symbol === ch) next.add(t.to);
      current = next;
      if (!current.size) return false;
    }
    return [...current].some(id => states.find(s => s.id === id).isFinal);
  };
}
