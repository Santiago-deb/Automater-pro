// Chequeo del motor de simulación. Correr con: node tests/engine.test.mjs
import assert from 'node:assert/strict';
import { simulateAFD } from '../js/engine/afd.js';
import { simulateAPD, findConflict } from '../js/engine/apd.js';
import { exampleAFD, exampleAPD } from '../js/engine/examples.js';

const afd = exampleAFD(0, 0, 800);       // número par de 1s
const run = (a, s) => simulateAFD(a, s).result;
assert.equal(run(afd, '110011'), 'accepted');
assert.equal(run(afd, ''), 'accepted');
assert.equal(run(afd, '1'), 'rejected');
assert.equal(run(afd, '12'), 'rejected');
assert.equal(simulateAFD({ ...afd, states: [] }, '1').result, 'warning');
assert.equal(simulateAFD(afd, '0110').trace.length, 5);

const apd = exampleAPD(0, 0, 800, 600);  // aⁿbⁿ, n > 0
const runP = s => simulateAPD(apd, s);
assert.equal(runP('aabb').result, 'accepted');
assert.equal(runP('ab').result, 'accepted');
assert.equal(runP('aab').result, 'rejected');
assert.equal(runP('abb').result, 'rejected');   // antes lanzaba ReferenceError (`top`)
assert.match(runP('abb').msg, /Sin transición para "b"/);
assert.equal(runP('').result, 'rejected');
assert.equal(runP('aabb').trace.at(-1).stack.join(''), 'Z');

// Bucle ε infinito
const loop = { ...apd, transitions: [{ id: 1, from: 1, to: 1, symbol: '', isEpsilon: true, stackTop: 'Z', stackReplace: 'Z' }] };
assert.equal(simulateAPD(loop, '').result, 'warning');

// Determinismo: duplicado no-ε y mezcla ε/no-ε con mismo (estado, tope)
assert.ok(findConflict(apd.transitions, 2, 'a', 'A'));
assert.ok(findConflict(apd.transitions, 3, 'b', 'Z'));   // ya hay ε con tope Z en q2→q3
assert.ok(!findConflict(apd.transitions, 1, 'b', 'Z'));

console.log('engine OK');

// MT de 2 cintas: aⁿbⁿc²ⁿ (ejemplo de la filmina)
import { simulateMT, findConflictMT, mtLabel, mtDelta, configuration } from '../js/engine/mt.js';
import { exampleMT } from '../js/engine/examples.js';
const mt = exampleMT(0, 0);
const runM = s => simulateMT(mt, s);
for (const s of ['abcc', 'aabbcccc', 'aaabbbcccccc']) assert.equal(runM(s).result, 'accepted', s);
for (const s of ['', 'abc', 'aabbccc', 'abbcc', 'aabcccc', 'abccc', 'ba']) assert.equal(runM(s).result, 'rejected', s);
assert.equal(runM('abd').result, 'rejected');
assert.deepEqual(runM('abcc').trace.at(-1).tapes[1], ['X', 'A', 'B']);
assert.equal(mtLabel(mt.transitions[0]), 'a,B/<a,N><X,D>');
assert.equal(mtDelta(mt.transitions[0], 'q0', 'q1'), 'δ(q0, a, B) = (q1, (a,N), (X,D))');
assert.ok(findConflictMT(mt.transitions, 2, ['a', 'B']));
assert.ok(!findConflictMT(mt.transitions, 2, ['c', 'B']));

// 1 cinta: corre a derecha hasta el blanco (acepta a*), izquierda desde la celda 0 rechaza, bucle → warning
const one = (transitions, finals = [2]) => ({
  alphabet: ['a'], tapeCount: 1, transitions,
  states: [1, 2].map(id => ({ id, label: `q${id - 1}`, isStart: id === 1, isFinal: finals.includes(id) }))
});
const scan = one([{ id: 1, from: 1, to: 1, reads: ['a'], writes: ['X'], moves: ['D'] },
                  { id: 2, from: 1, to: 2, reads: ['B'], writes: ['B'], moves: ['N'] }]);
assert.equal(simulateMT(scan, 'aaa').result, 'accepted');
assert.deepEqual(simulateMT(scan, 'aaa').trace.at(-1).tapes[0], ['X', 'X', 'X', 'B']);
assert.equal(mtDelta(scan.transitions[0], 'q0', 'q0'), 'δ(q0, a) = (q0, X, D)');
assert.match(simulateMT(one([{ id: 1, from: 1, to: 2, reads: ['a'], writes: ['a'], moves: ['I'] }]), 'a').msg, /izquierda/);
assert.equal(simulateMT(one([{ id: 1, from: 1, to: 1, reads: ['B'], writes: ['B'], moves: ['N'] }]), '').result, 'warning');
assert.equal(simulateMT({ ...scan, alphabet: ['a', 'B'] }, 'a').result, 'warning');
assert.equal(configuration(['X', 'a', 'b', 'B'], 1, 'q2'), 'X q2 ab');
assert.equal(configuration(['X', 'X'], 2, 'q1'), 'XX q1 B');

console.log('MT OK');
