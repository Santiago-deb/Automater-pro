// Registro de tipos de autómata: cómo se simula, cómo se rotula una transición
// y qué ejemplo se carga. Agregar un tipo = un motor nuevo + una entrada acá.
import { simulateAFD } from './afd.js';
import { simulateAPD, apdLabel } from './apd.js';
import { simulateMT, mtLabel } from './mt.js';
import { exampleAFD, exampleAPD, exampleMT } from './examples.js';

export const AUTOMATA = {
  afd: { simulate: simulateAFD, label: t => t.symbol, example: exampleAFD },
  apd: { simulate: simulateAPD, label: apdLabel, example: exampleAPD },
  mt: { simulate: simulateMT, label: mtLabel, example: exampleMT }
};
