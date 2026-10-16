// Registro de tipos de autómata: cómo se simula, cómo se rotula una transición,
// cómo se detecta el no determinismo (conflict) y qué ejemplo se carga. Agregar un tipo = un motor nuevo + una entrada acá.
import { simulateAF, afConflict } from './af.js';
import { simulateAPD, apdLabel, apdConflict } from './apd.js';
import { simulateMT, mtLabel, mtConflict } from './mt.js';
import { exampleAFD, exampleAPD, exampleMT } from './examples.js';

export const AUTOMATA = {
  afd: { simulate: simulateAF, conflict: afConflict, label: t => t.symbol, example: exampleAFD },
  apd: { simulate: simulateAPD, conflict: apdConflict, label: apdLabel, example: exampleAPD },
  mt: { simulate: simulateMT, conflict: mtConflict, label: mtLabel, example: exampleMT }
};
