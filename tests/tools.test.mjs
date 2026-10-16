// Herramientas de los TPs con ejercicios reales de los prácticos y filminas.
// Correr con: node tests/tools.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulateAF, isDeterministic, subsetConstruction, minimize, allStrings, maxLengthFor } from '../js/engine/af.js';
import { afToGrammar, grammarText, derivation, grammarToAF, regexMatcher, regexToAF, parseRegex, afToRegex } from '../js/engine/regular.js';
import { parseAFTable, parseAPDTable, parseMTTable, parseMTFile, formalDefinition, parseBatch, tableText } from '../js/engine/table.js';
import { simulateAPD } from '../js/engine/apd.js';
import { simulateMT } from '../js/engine/mt.js';

const accepts = (a, w) => simulateAF(a, w).result === 'accepted';
const lang = (a, n) => [...allStrings(a.alphabet, n)].filter(w => accepts(a, w));
const same = (a, b, n = 7) => assert.deepEqual(lang(a, n), lang(b, n));

// --- AFND (filmina: termina en b) y subconjuntos ---
const nd = parseAFTable(`δ a b c
→e0 e0 {e0,e1} e0
*e1 - - -`);
assert.ok(!nd.error, nd.error);
const ndA = nd.automaton;
assert.equal(isDeterministic(ndA.transitions), false);
assert.ok(accepts(ndA, 'aab') && !accepts(ndA, 'aba'));
const sub = subsetConstruction(ndA);
assert.deepEqual(sub.rows.map(r => r.name), ['[e0]', '[e0,e1]']);
assert.deepEqual(sub.rows[0].next, ['[e0]', '[e0,e1]', '[e0]']);
assert.ok(isDeterministic(sub.automaton.transitions));
same(ndA, sub.automaton);

// TP2 ej 11: AFND e0 -0,1-> e0, e0 -0-> e1, e1 -1-> e2
const tp211 = parseAFTable(`δ 0 1
→e0 {e0,e1} e0
e1 - e2
*e2 - -`).automaton;
const sub211 = subsetConstruction(tp211);
assert.deepEqual(sub211.rows.map(r => r.name), ['[e0]', '[e0,e1]', '[e0,e2]']);
same(tp211, sub211.automaton, 8);

// [] aparece cuando un subconjunto no tiene destino
const trap = subsetConstruction(parseAFTable(`δ a b\n→p q -\n*q - -`).automaton);
assert.ok(trap.rows.some(r => r.name === '[]'));

// --- Minimización (filmina ejemplo 3: suma múltiplo de 4) ---
const ej3 = parseAFTable(`δ 1 2
→*e0 e1 e4
e1 e2 e3
e2 e3 e5
e3 e5 e1
e4 e3 e5
*e5 e1 e4`).automaton;
const min3 = minimize(ej3);
assert.equal(min3.groups.length, 4);
assert.deepEqual(min3.steps[0].groups.map(g => g.states), [['e1', 'e2', 'e3', 'e4'], ['e0', 'e5']]);
assert.deepEqual(min3.steps.at(-1).groups.map(g => g.states.join('')), ['e1', 'e2e4', 'e3', 'e0e5']);
assert.deepEqual(min3.groups[0].states, ['e0', 'e5']); // p0 = grupo del inicial
same(ej3, min3.automaton, 8);

// TP2 ej 12a
const afd1 = parseAFTable(`δ a b
→p q p
*q r s
*r q t
s t u
t s u
u q u`).automaton;
const min1 = minimize(afd1);
assert.ok(min1.groups.length < 6);
same(afd1, min1.automaton, 8);

// Inalcanzables y muertos (filmina ejemplo 1)
const m1 = minimize(sub.automaton);
assert.deepEqual(m1.unreachable, []);
const withDead = parseAFTable(`δ a b\n→p q d\n*q q d\nd d d\nx p p`).automaton;
const md = minimize(withDead);
assert.deepEqual(md.unreachable, ['x']);
assert.deepEqual(md.dead, ['d']);
assert.equal(minimize(ndA).error !== undefined, true); // AFND: pedir pasaje a AFD

// --- AF → GR (Apunte 3, ejemplo 1: contiene 00 u 11) ---
const l4 = parseAFTable(`δ 0 1
→p0 p1 p2
p1 p3 p2
p2 p1 p3
*p3 p3 p3`).automaton;
const g4 = afToGrammar(l4);
assert.equal(grammarText(g4), [
  'S → 0A | 1B',
  'A → 0C | 0 | 1B',
  'B → 0A | 1C | 1',
  'C → 0C | 0 | 1C | 1'
].join('\n'));
assert.deepEqual(derivation(l4, g4, '0100'), ['S', '0A', '01B', '010A', '0100']);
assert.equal(derivation(l4, g4, '0101'), null);

// Inicial con arcos entrantes: S y otro no terminal; inicial final: S → λ
const par = parseAFTable(`δ a b\n→*e0 e0 e1\ne1 e1 e0`).automaton; // cantidad par de b
const gp = afToGrammar(par);
assert.match(grammarText(gp), /^S → λ \| aA \| a \| bB/);
assert.ok(!gp.productions.some(p => p.right.includes('S')));

// --- GR → AF (TP3 ej 2a: 1(01)*) ---
const g2a = grammarToAF('S → 1B | 1\nA → 1B | 1\nB → 0A');
assert.ok(!g2a.error, g2a.error);
for (const w of ['1', '101', '10101']) assert.ok(accepts(g2a.automaton, w), w);
for (const w of ['', '10', '11', '1001']) assert.ok(!accepts(g2a.automaton, w), w);
assert.match(grammarToAF('S → aBc').error, /lineal a derecha/);
// Ida y vuelta: AF → GR → AF reconoce lo mismo
same(l4, grammarToAF(grammarText(g4)).automaton, 7);

// --- Expresiones regulares (TP3 ej 5) ---
assert.equal(regexMatcher('(0*10)*')('10100010'), true);
assert.equal(regexMatcher('(0 + (11)*)*')('011100'), false);
assert.equal(regexMatcher('(011 + 11)*(00)*')('000111100'), false);
assert.equal(regexMatcher('01*10*(11*0)*')('011100101'), false);
assert.equal(regexMatcher('a*.b')('aaab'), true);
assert.equal(regexMatcher('(aa)*cb*b')('aacbb'), true);
assert.equal(regexMatcher('(aa)*cb*b')('acb'), false);
assert.equal(regexMatcher('λ + a')(''), true);
assert.equal(regexMatcher('∅')(''), false);
assert.throws(() => parseRegex('(a+b'), /paréntesis/);
assert.throws(() => parseRegex('a++b'), /fuera de lugar/);
const reAF = regexToAF('(a+b)*abb').automaton;
assert.ok(accepts(reAF, 'babb') && !accepts(reAF, 'abba'));

// --- AF → ER por eliminación de estados ---
// La ER obtenida tiene que generar exactamente el lenguaje del AF
const sameAsRegex = (a, n = 7) => {
  const r = afToRegex(a);
  assert.ok(!r.error, r.error);
  const m = regexMatcher(r.regex);
  for (const w of allStrings(a.alphabet, n)) assert.equal(m(w), accepts(a, w), `${r.regex} con "${w}"`);
  return r;
};
for (const a of [ndA, tp211, l4, g2a.automaton, reAF, sub.automaton]) sameAsRegex(a);
for (const src of ['(0*10)*', '(011 + 11)*(00)*', '01*10*(11*0)*', '(aa)*cb*b', 'λ + a', 'a*b + ba*']) {
  sameAsRegex(regexToAF(src).automaton, 6);
}
// Dos estados: S*U(T+VS*U)*
const two = parseAFTable(`δ a b\n→p p q\n*q p q`).automaton;
const r2 = sameAsRegex(two);
assert.deepEqual(r2.parts[0].stuv, { S: 'a', U: 'b', T: 'b', V: 'a' });
assert.equal(r2.regex, 'a*b(b + aa*b)*');
// Inicial final con bucle: S*
assert.equal(afToRegex(parseAFTable(`δ a\n→*p p`).automaton).regex, 'a*');
// Sin camino a un final: ∅
assert.equal(afToRegex(parseAFTable(`δ a\n→p p\n*q q`).automaton).regex, '∅');
assert.match(afToRegex(parseAFTable(`δ a\n→p p`).automaton).error, /final/);

// --- Tablas de APD y MT ---
const apd = parseAPDTable(`δ(e0, a, Z0) = (e0, AZ0)
δ(e0, a, A) = (e0, AA)
δ(e0, b, A) = (e1, λ)
δ(e1, b, A) = (e1, λ)
δ(e1, λ, Z0) = (e2, Z0)
Finales: e2`);
assert.ok(!apd.error, apd.error);
const apdA = { ...apd.automaton, initialStackSymbol: apd.initialStackSymbol, stackAlphabet: apd.stackAlphabet };
assert.equal(simulateAPD(apdA, 'aabb').result, 'accepted');
assert.equal(simulateAPD(apdA, 'aab').result, 'rejected');

// TP6 ej 1 (2 cintas)
const mt = parseMTTable(`e0 a B a N X D e1
e0 b B b N X D e2
e0 B B B N B N e5
e1 a B a D 1 D e1
e1 b B b N B N e2
e1 c B c N B I e3
e2 b B b D 1 D e2
e2 c B c N B I e3
e3 c 1 c D 1 I e3
e3 d X d N X D e4
e4 d 1 d D 1 D e4
e4 B B B N B N e5
e5 - - - - - - -
Finales: e5`, ['a', 'b', 'c', 'd']);
assert.ok(!mt.error, mt.error);
assert.equal(mt.tapeCount, 2);
assert.deepEqual(mt.tapeAlphabet, ['X', '1']);
const mtA = { ...mt.automaton, tapeCount: 2, tapeAlphabet: mt.tapeAlphabet };
const mtRes = w => simulateMT(mtA, w).result;
console.log('TP6 ej1a:', ['abccdd', 'abcdd', 'aaccdd', 'bbbcccddd', 'aabcccdd'].map(w => `${w}=${mtRes(w)}`).join(' '));
assert.match(parseMTTable('e0 a a X e1').error, /movimiento/);

// --- Definición formal ---
const fd = formalDefinition('afd', ndA);
assert.equal(fd.tuple, 'AFND = <{e0, e1}, {a, b, c}, δ, e0, {e1}>');
assert.deepEqual(fd.rows[0], ['→e0', '{e0}', '{e0, e1}', '{e0}']);
const fdm = formalDefinition('mt', mtA);
assert.deepEqual(fdm.headers, ['Estado', 'C1', 'C2', 'C1 nuevo', 'Mov.', 'C2 nuevo', 'Mov.', 'Nuevo estado']);
assert.ok(tableText(fd.headers, fd.rows).includes('→e0'));

// --- Lotes ---
assert.deepEqual(parseBatch('+ab\n- ba\nλ\n\naab'), [
  { input: 'ab', expect: 'accepted' }, { input: 'ba', expect: 'rejected' },
  { input: '', expect: null }, { input: 'aab', expect: null }
]);
assert.equal(maxLengthFor(2, 5000), 11);

// --- Archivos .MT de MTSolution (latin1, TAB) ---
const mtFile = name => new TextDecoder('latin1').decode(readFileSync(new URL(`fixtures/${name}`, import.meta.url)));
const copiar = parseMTFile(mtFile('CopiarC1EnC2.MT'));
assert.ok(!copiar.error, copiar.error);
assert.equal(copiar.tapeCount, 2);
assert.deepEqual(copiar.alphabet, ['0', '1']);
assert.deepEqual(copiar.automaton.states.map(s => [s.label, s.isStart, s.isFinal]), [['e0', true, false], ['e1', false, true]]);
assert.equal(copiar.automaton.transitions.length, 3);
const copiarMT = { ...copiar.automaton, alphabet: copiar.alphabet, tapeAlphabet: copiar.tapeAlphabet, tapeCount: 2 };
const run = simulateMT(copiarMT, '1011');
assert.equal(run.result, 'accepted');
assert.equal(run.trace.at(-1).tapes[1].join('').replace(/B+$/, ''), '1011');
assert.equal(simulateMT(copiarMT, '').result, 'accepted');
// Las MT con sub-máquinas todavía no se importan
assert.match(parseMTFile(mtFile('X+Y_compuesta.MT')).error, /@Copiar/);
assert.match(parseMTFile('{"app":"automater-pro"}').error, /MTSolution/);

console.log('tools OK');
