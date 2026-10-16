// Pruebas de punta a punta en un Chromium real, sin dependencias: levanta un
// servidor estático propio, abre Chromium headless y lo maneja por el protocolo
// de DevTools con eventos de mouse y teclado de verdad.
// Correr con: node tests/e2e.mjs   (CHROME=/ruta/al/navegador si no es chromium)
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn, execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURES = join(ROOT, 'tests', 'fixtures');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- Servidor estático ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_APP = `http://127.0.0.1:${server.address().port}/`;

// ---------- Chromium ----------
const chrome = process.env.CHROME ?? ['chromium', 'google-chrome', 'chromium-browser']
  .find(b => { try { execSync(`command -v ${b}`, { stdio: 'ignore' }); return true; } catch { return false; } });
if (!chrome) {
  console.log('e2e: no encontré Chromium (usa CHROME=/ruta/al/navegador). Se saltean las pruebas.');
  server.close();
  process.exit(0);
}
const profile = await mkdtemp(join(tmpdir(), 'automater-e2e-'));
const browser = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--window-size=1300,900', '--no-first-run', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((ok, fail) => {
  let buf = '';
  browser.stderr.on('data', d => { buf += d; const m = buf.match(/ws:\/\/[^\s]+/); if (m) ok(m[0]); });
  browser.on('exit', () => fail(new Error('Chromium se cerró al arrancar')));
});
const port = new URL(wsUrl).port;
const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });

let seq = 0;
const pending = {};
const errors = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
};
const cmd = (method, params = {}) => new Promise(r => { const id = ++seq; pending[id] = r; ws.send(JSON.stringify({ id, method, params })); });
async function ev(expression) {
  const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(`${expression}\n→ ${r.result.exceptionDetails.exception?.description}`);
  return r.result.result.value;
}

// ---------- Mouse y teclado ----------
const SHIFT = 8;
const CTRL = 2;
const mouse = (type, x, y, mod = 0, count = 1) => cmd('Input.dispatchMouseEvent',
  { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: count, modifiers: mod });
async function click(x, y, mod = 0, count = 1) {
  await mouse('mousePressed', x, y, mod, count);
  await mouse('mouseReleased', x, y, mod, count);
  await sleep(60);
}
async function dblclick(x, y) {
  await sleep(400); // que no se junte con un clic anterior
  await click(x, y);
  await click(x, y, 0, 2);
  await sleep(150);
}
async function drag(x1, y1, x2, y2, mod = 0) {
  await mouse('mouseMoved', x1, y1, mod);
  await mouse('mousePressed', x1, y1, mod);
  for (let k = 1; k <= 8; k++) await mouse('mouseMoved', x1 + (x2 - x1) * k / 8, y1 + (y2 - y1) * k / 8, mod);
  await mouse('mouseReleased', x2, y2, mod);
  await sleep(150);
}
async function key(k, code, vk, mod = 0) {
  for (const type of ['keyDown', 'keyUp']) await cmd('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, modifiers: mod });
  await sleep(150);
}
const undoKey = () => key('z', 'KeyZ', 90, CTRL);
const redoKey = () => key('Z', 'KeyZ', 90, CTRL | SHIFT);

// ---------- Lectura de la página ----------
const states = () => ev(`[...document.querySelectorAll('.state-node')].map(g => {
  const b = g.querySelector('.state-circle').getBoundingClientRect();
  return { label: g.querySelector('.state-label').textContent, x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2),
    sel: g.classList.contains('is-selected'), final: g.classList.contains('is-final') };
})`);
const byLabel = async l => (await states()).find(s => s.label === l);
const selected = () => ev(`({ states: document.querySelectorAll('.state-node.is-selected').length,
  edges: document.querySelectorAll('.edge-group.is-selected').length, totalEdges: document.querySelectorAll('.edge-group').length })`);
const menuOpen = () => ev(`!!document.querySelector('.state-menu')`);
const result = () => ev(`document.getElementById('testResult').innerText`);
// Verifica y espera a que aparezca el resultado (la animación de la MT es larga)
async function verify(w, wait = 4000) {
  await ev(`document.getElementById('testString').value = ${JSON.stringify(w)}; document.getElementById('btnVerify').click()`);
  const until = Date.now() + Math.max(wait, 15000);
  await sleep(Math.min(wait, 500));
  while (Date.now() < until && !(await ev(`document.getElementById('testResult').classList.contains('show')`))) await sleep(200);
  return result();
}
async function setType(type) {
  await ev(`document.querySelector('.type-btn[data-type=${type}]').click()`);
  await sleep(500);
}
// Ejemplo del tipo, alejado para que ningún estado quede bajo la barra de herramientas
async function example(type) {
  await setType(type);
  await ev(`document.getElementById('btnExample').click()`);
  await sleep(300);
  await ev(`document.getElementById('zoomOut').click(); document.getElementById('zoomOut').click()`);
  await sleep(200);
}
async function setMode(mode) {
  await ev(`document.querySelector('.tool-btn[data-mode=${mode}]').click()`);
  await sleep(100);
}
async function openFiles(...names) {
  await ev(`document.querySelector('[data-file="open"]').click()`);
  await sleep(300);
  const { root } = (await cmd('DOM.getDocument')).result;
  const { nodeId } = (await cmd('DOM.querySelector', { nodeId: root.nodeId, selector: '#fileInput' })).result;
  await cmd('DOM.setFileInputFiles', { nodeId, files: names.map(n => join(FIXTURES, n)) });
  await sleep(1200);
}
const emptySpot = async () => {
  const s = await states();
  return { x: Math.max(...s.map(p => p.x)) + 120, y: Math.max(...s.map(p => p.y)) + 160 };
};

// ---------- Pruebas ----------
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${e.message.split('\n').join('\n      ')}`);
  }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }

await cmd('Page.enable');
await cmd('Runtime.enable');
await cmd('DOM.enable');
await cmd('Page.setInterceptFileChooserDialog', { enabled: true });
await cmd('Page.navigate', { url: URL_APP });
await sleep(2500);
console.log(`e2e en ${chrome}`);

await test('los ejemplos de AF, APD y MT se aceptan', async () => {
  for (const type of ['afd', 'apd', 'mt']) {
    await example(type);
    const r = await verify(await ev(`document.getElementById('testString').value`), type === 'mt' ? 8000 : 5000);
    check(/aceptada/i.test(r), `${type}: ${r}`);
  }
});

await test('Herramientas y menú Archivo abren', async () => {
  await ev(`document.getElementById('btnTools').click()`);
  await sleep(300);
  check(await ev(`document.getElementById('toolsModal').classList.contains('show')`), 'no abrió Herramientas');
  await ev(`document.getElementById('toolsClose').click()`);
  await ev(`document.getElementById('btnFile').click()`);
  await sleep(200);
  const items = await ev(`[...document.querySelectorAll('#fileMenu [data-file]')].filter(b => b.offsetParent).map(b => b.dataset.file).join(',')`);
  check(items.startsWith('new,open,save,share,print,png'), `menú: ${items}`);
  await key('Escape', 'Escape', 27);
});

await test('importar .MT y MT compuesta (@Copiar)', async () => {
  await openFiles('X+Y_compuesta.MT');
  check(/Faltan módulos: CopiarC1EnC2\.MT/.test(await ev(`document.getElementById('toast').textContent`)), 'no avisó del módulo faltante');
  check(/Falta cargar el módulo Copiar/.test(await verify('11', 500)), 'verificó sin el módulo');
  await openFiles('CopiarC1EnC2.MT', 'X+Y_compuesta.MT');
  check(/✓ MT de 2 cintas/.test(await ev(`document.getElementById('moduleList').innerText`)), 'el módulo no quedó cargado');
  check(/aceptada/i.test(await verify('111')), 'X+Y no aceptó 111');
  check(/@Copiar ✓/.test(await ev(`document.getElementById('testTrace').innerText`)), 'la traza no muestra la llamada');
});

await test('rectángulo de selección y clic en el fondo', async () => {
  await example('mt');
  const s = await states();
  const x1 = Math.min(...s.map(p => p.x)) - 50, y1 = Math.min(...s.map(p => p.y)) - 90;
  const x2 = Math.max(...s.map(p => p.x)) + 50, y2 = Math.max(...s.map(p => p.y)) + 60;
  await drag(x1, y1, x2, y2);
  const sel = await selected();
  check(sel.states === s.length && sel.edges === sel.totalEdges, `seleccionó ${sel.states}/${s.length} estados y ${sel.edges}/${sel.totalEdges} aristas`);
  check(!(await ev(`!!document.querySelector('.marquee')`)), 'el rectángulo quedó dibujado');
  const empty = await emptySpot();
  await click(empty.x, empty.y);
  check((await selected()).states === 0, 'no deseleccionó');
});

await test('Shift + clic suma y quita; el grupo se mueve junto', async () => {
  const [, a, b, c] = await states();
  await sleep(400);
  await click(a.x, a.y);
  await click(b.x, b.y, SHIFT);
  await click(c.x, c.y, SHIFT);
  check((await selected()).states === 3, 'no quedaron 3 seleccionados');
  await sleep(400);
  await click(b.x, b.y, SHIFT);
  check((await states()).filter(p => p.sel).map(p => p.label).join() === [a.label, c.label].join(), 'Shift + clic no quitó el estado');
  await drag(a.x, a.y, a.x + 80, a.y + 50);
  const [a2, b2, c2] = [await byLabel(a.label), await byLabel(b.label), await byLabel(c.label)];
  check(Math.abs(a2.x - a.x - 80) <= 2 && Math.abs(c2.x - c.x - 80) <= 2 && b2.x === b.x, 'el grupo no se movió bien');
});

await test('Ctrl+Z, Ctrl+Shift+Z y los botones', async () => {
  const pos = async () => JSON.stringify((await states()).map(p => [p.label, p.x, p.y]));
  const before = await pos();
  await undoKey();
  const undone = await pos();
  check(undone !== before, 'Ctrl+Z no deshizo el arrastre');
  await redoKey();
  check(await pos() === before, 'Ctrl+Shift+Z no rehízo');
  await ev(`document.getElementById('btnUndo').click()`);
  await sleep(150);
  check(await pos() === undone, 'el botón Deshacer no anduvo');
  await ev(`document.getElementById('btnRedo').click()`);
  await sleep(150);
  check(await ev(`document.getElementById('btnRedo').disabled`), 'Rehacer quedó habilitado sin nada que rehacer');
  await ev(`document.getElementById('alphabetInput').focus()`);
  await undoKey();
  check(await pos() === before, 'Ctrl+Z en un campo de texto tocó el tablero');
  await ev(`document.activeElement.blur()`);
});

await test('menú del estado: renombrar, final y cerrar', async () => {
  const q1 = await byLabel('q1');
  await dblclick(q1.x, q1.y);
  check(await menuOpen(), 'el doble clic no abrió el menú');
  await ev(`(() => { const i = document.querySelector('.state-menu-input'); i.focus(); i.value = 'z9'; })()`);
  await key('Enter', 'Enter', 13);
  check(await byLabel('z9') && !(await menuOpen()), 'no renombró');
  await sleep(400);
  await undoKey();
  check(await byLabel('q1'), 'Ctrl+Z no deshizo el renombre');
  await dblclick(q1.x, q1.y);
  await ev(`[...document.querySelectorAll('.state-menu-item')].find(b => /final/i.test(b.textContent)).click()`);
  await sleep(150);
  check((await byLabel('q1')).final, 'no marcó como final');
  await dblclick(q1.x, q1.y);
  await key('Escape', 'Escape', 27);
  check(!(await menuOpen()), 'Escape no cerró el menú');
  await undoKey();
});

await test('modo Agregar: selecciona, mueve, crea y abre el menú', async () => {
  await setMode('add');
  const q2 = await byLabel('q2');
  await sleep(400);
  await click(q2.x, q2.y);
  const now = await byLabel('q2');
  check(now.sel && now.final === q2.final, 'el clic no seleccionó o cambió el final');
  await drag(q2.x, q2.y, q2.x - 30, q2.y + 60);
  check(Math.abs((await byLabel('q2')).y - q2.y - 60) <= 2, 'no movió el estado');
  const n = (await states()).length;
  const empty = await emptySpot();
  await click(empty.x, empty.y);
  check((await states()).length === n + 1, 'el clic en vacío no creó un estado');
  const q2b = await byLabel('q2');
  await dblclick(q2b.x, q2b.y);
  check(await menuOpen(), 'el doble clic no abrió el menú');
  await key('Escape', 'Escape', 27);
});

await test('modo Conectar: arrastra, Shift + clic, conecta con dos clics y doble clic = bucle', async () => {
  await example('mt');
  await setMode('connect');
  const q1 = await byLabel('q1');
  await drag(q1.x, q1.y, q1.x + 20, q1.y + 70);
  check(Math.abs((await byLabel('q1')).y - q1.y - 70) <= 2, 'no movió el estado');
  check(!(await ev(`!!document.querySelector('.connecting-source')`)), 'el arrastre marcó un origen');
  const [q2, q3] = [await byLabel('q2'), await byLabel('q3')];
  await sleep(400);
  await click(q2.x, q2.y, SHIFT);
  await click(q3.x, q3.y, SHIFT);
  check((await selected()).states === 2, 'Shift + clic no seleccionó');
  const empty = await emptySpot();
  await click(empty.x, empty.y);
  await sleep(400);
  await click(q2.x, q2.y);
  await sleep(450);
  await click(q3.x, q3.y);
  check(await ev(`document.getElementById('tapeModal').classList.contains('show')`), 'no abrió el modal de transición');
  await ev(`document.getElementById('tapeModalCancel').click()`);
  await dblclick(q3.x, q3.y);
  check(!(await menuOpen()), 'el doble clic abrió el menú');
  check(await ev(`document.getElementById('tapeModal').classList.contains('show')`), 'el doble clic no abrió el modal del bucle');
  check(await ev(`document.getElementById('tapeModalFrom').textContent === document.getElementById('tapeModalTo').textContent`), 'el modal no es de un bucle');
  await ev(`document.getElementById('tapeModalCancel').click()`);
});

await test('modo Eliminar y Supr; un Ctrl+Z recupera todo', async () => {
  await setMode('delete');
  const n = (await states()).length;
  const q5 = await byLabel('q5');
  await click(q5.x, q5.y);
  check((await states()).length === n - 1 && !(await menuOpen()), 'no borró el estado');
  await undoKey();
  await setMode('select');
  const edges = (await selected()).totalEdges;
  const [a, b] = [await byLabel('q1'), await byLabel('q2')];
  await sleep(400);
  await click(a.x, a.y);
  await click(b.x, b.y, SHIFT);
  await key('Delete', 'Delete', 46);
  check((await states()).length === n - 2, 'Supr no borró la selección');
  await undoKey();
  check((await states()).length === n && (await selected()).totalEdges === edges, 'Ctrl+Z no recuperó estados y aristas');
});

await test('un autómata no determinístico no deja probar cadenas', async () => {
  await openFiles('afnd.json');
  check(/no determinístico \(δ\(e0, b\) tiene más de un destino: e0, e1\)/.test(await verify('ab', 500)), 'Verificar no se bloqueó');
  check(await ev(`document.querySelector('.state-node.current .state-label')?.textContent`) === 'e0', 'no resaltó el estado del conflicto');
  await ev(`document.querySelectorAll('.trans-delete')[2].click()`);
  await sleep(200);
  check(!/no determinístico/.test(await verify('ab', 2500)), 'sigue bloqueado sin el no determinismo');
});

await test('Deshacer del aviso vuelve al tablero y al tipo anteriores', async () => {
  await example('afd');
  const before = (await states()).map(p => p.label).join();
  await openFiles('CopiarC1EnC2.MT');
  check(await ev(`document.body.classList.contains('mt')`), 'no cambió a MT');
  await ev(`document.querySelector('#toast .toast-action').click()`);
  await sleep(300);
  check(!(await ev(`document.body.classList.contains('mt')`)) && (await states()).map(p => p.label).join() === before, 'no volvió al AF anterior');
});

await test('deshacer no actúa mientras se anima una prueba', async () => {
  await example('mt');
  const n = (await states()).length;
  await ev(`document.getElementById('btnVerify').click()`);
  await sleep(300);
  await ev(`document.getElementById('btnUndo').click()`);
  await undoKey();
  check((await states()).length === n, 'deshizo durante la animación');
  await sleep(8000);
  check(/aceptada/i.test(await result()), 'la prueba no terminó bien');
});

await test('celular: pellizco para zoom, un dedo desplaza dentro de los límites', async () => {
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 800, deviceScaleFactor: 2, mobile: true });
  await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await sleep(300);
  await example('afd');
  await ev(`document.getElementById('zoomReset').click()`);
  await sleep(200);
  const box = await ev(`(() => { const b = document.getElementById('canvas').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
  const cx = Math.round(box.x + box.w / 2), cy = Math.round(box.y + box.h / 2);
  const cam = () => ev(`(() => { const m = document.getElementById('viewport').transform.baseVal.consolidate()?.matrix; return m ? { x: m.e, y: m.f, s: m.a } : { x: 0, y: 0, s: 1 }; })()`);
  const touch = (type, points) => cmd('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
  // Un toque en el fondo, en modo Agregar, crea un estado
  await setMode('add');
  const n = (await states()).length;
  const spot = await ev(`(() => {
    const b = document.getElementById('canvas').getBoundingClientRect();
    for (let y = b.bottom - 90; y > b.top + 80; y -= 30)
      for (let x = b.left + 30; x < b.right - 80; x += 30)
        if (document.elementFromPoint(x, y)?.id === 'canvas') return [Math.round(x), Math.round(y)];
  })()`);
  check(spot, 'no encontré un lugar vacío para tocar');
  await touch('touchStart', [spot]);
  await touch('touchEnd', []);
  await sleep(300);
  check((await states()).length === n + 1, 'el toque no agregó un estado');
  // Pellizco: los dedos se separan → acerca
  const before = await cam();
  await touch('touchStart', [[cx - 20, cy + 120]]);
  await touch('touchStart', [[cx - 20, cy + 120], [cx + 20, cy + 120]]);
  for (let k = 1; k <= 6; k++) await touch('touchMove', [[cx - 20 - k * 12, cy + 120], [cx + 20 + k * 12, cy + 120]]);
  await touch('touchEnd', []);
  await sleep(200);
  const zoomed = await cam();
  check(zoomed.s > before.s * 1.8, `el pellizco no acercó (escala ${before.s.toFixed(2)} → ${zoomed.s.toFixed(2)})`);
  // Un dedo en modo Agregar: desplaza (sin crear estados) y no pasa de los límites
  const m = (await states()).length;
  const ey = Math.round(box.y + box.h - 30);
  await touch('touchStart', [[cx, ey]]);
  for (let k = 1; k <= 10; k++) await touch('touchMove', [[cx - k * 300, ey - k * 300]]);
  await touch('touchEnd', []);
  await sleep(200);
  check((await states()).length === m, 'arrastrar el tablero con el dedo creó un estado');
  // La vista no sale de la zona del autómata (centros de los estados ± 78 del mundo)
  const inside = await ev(`(() => {
    const m = document.getElementById('viewport').transform.baseVal.consolidate().matrix;
    const c = [...document.querySelectorAll('.state-node')].map(g => g.transform.baseVal.consolidate().matrix);
    const b = document.getElementById('canvas').getBoundingClientRect();
    const sx = x => b.left + m.e + x * m.a, sy = y => b.top + m.f + y * m.a;
    const l = sx(Math.min(...c.map(t => t.e)) - 78), r = sx(Math.max(...c.map(t => t.e)) + 78);
    const t = sy(Math.min(...c.map(t => t.f)) - 78), bo = sy(Math.max(...c.map(t => t.f)) + 78);
    return r > b.left + 1 && l < b.right - 1 && bo > b.top + 1 && t < b.bottom - 1;
  })()`);
  check(inside, 'el tablero se fue más allá del autómata');
  await cmd('Emulation.setTouchEmulationEnabled', { enabled: false });
  await cmd('Emulation.clearDeviceMetricsOverride');
  await setMode('select');
});

await test('sin errores en la consola', async () => {
  check(!errors.length, errors.join('\n'));
});

ws.close();
browser.kill();
await new Promise(r => browser.once('exit', r));
server.close();
await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {}); // Chromium puede seguir escribiendo un instante
console.log(failed ? `e2e: ${failed} prueba(s) fallaron` : 'e2e OK');
process.exit(failed ? 1 : 0);
