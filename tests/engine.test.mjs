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
