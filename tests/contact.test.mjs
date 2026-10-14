// Chequeos de api/contact.js con fetch simulado (no manda mails).
// Correr con: node tests/contact.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const sent = [];
let formsubmitOk = true;
globalThis.fetch = async (url, opts) => {
  sent.push({ url, body: JSON.parse(opts.body), headers: opts.headers });
  return new Response(JSON.stringify(formsubmitOk ? { success: 'true' } : { success: 'false', message: 'x' }), { status: 200 });
};
const handler = createRequire(import.meta.url)('../api/contact.js');

async function call({ method = 'POST', ip = '1.1.1.1', origin = 'https://automater-pro.vercel.app', body } = {}) {
  const req = {
    method,
    headers: { host: 'automater-pro.vercel.app', origin, 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: body ?? { email: 'alumno@ejemplo.com', motivo: 'Reportar un error', mensaje: 'El bucle en q3 no se dibuja bien.' }
  };
  const res = { headers: {}, code: 0, data: null,
    setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(d) { this.data = d; } };
  await handler(req, res);
  return res;
}

assert.equal((await call({ method: 'GET' })).code, 405);
assert.equal((await call({ origin: 'https://otro-sitio.com' })).code, 403);
assert.equal((await call({ origin: null })).code, 403);
const bad = await call({ body: { email: 'no-es-mail', motivo: 'x', mensaje: 'mensaje largo de prueba' } });
assert.equal(bad.code, 400);
assert.equal(bad.data.field, 'email');
assert.equal(sent.length, 0);

// 3 por hora por IP; el 4.º se rechaza con Retry-After
for (let i = 0; i < 3; i++) assert.equal((await call()).code, 200);
const limited = await call();
assert.equal(limited.code, 429);
assert.match(limited.data.message, /Podrás enviar otro en \d+ minutos?/);
assert.ok(+limited.headers['Retry-After'] > 0);
assert.equal(sent.length, 3);

// Otra IP no está afectada
assert.equal((await call({ ip: '2.2.2.2' })).code, 200);

// Solo se reenvían los campos permitidos y el destino no viene del cliente
const injected = await call({ ip: '3.3.3.3', body: { email: 'a@b.co', motivo: 'Hola', mensaje: 'mensaje de prueba ok', _cc: 'victima@x.com', _next: 'https://evil' } });
assert.equal(injected.code, 200);
const last = sent.at(-1);
assert.match(last.url, /^https:\/\/formsubmit\.co\/ajax\//);
assert.equal(last.body._cc, undefined);
assert.equal(last.body._next, undefined);
assert.equal(last.body._replyto, 'a@b.co');
assert.equal(last.body._subject, '[Automater Pro] Hola');

// Honeypot: responde OK pero no envía
const before = sent.length;
assert.equal((await call({ ip: '4.4.4.4', body: { email: 'a@b.co', motivo: 'x', mensaje: 'mensaje de bot!!', _honey: 'spam' } })).code, 200);
assert.equal(sent.length, before);

// Falla de FormSubmit → 502 con mensaje
formsubmitOk = false;
assert.equal((await call({ ip: '5.5.5.5' })).code, 502);
formsubmitOk = true;

// Tope global por día (60) aunque cambie la IP
let code = 200;
for (let i = 0; i < 70 && code !== 429; i++) code = (await call({ ip: `9.9.${i}.1` })).code;
assert.equal(code, 429);

console.log('contact OK');
