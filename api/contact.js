// Función serverless de Vercel: recibe el formulario de contacto, limita los
// envíos por IP y recién ahí lo reenvía a FormSubmit. Así el destino no queda
// en el código de la página y nadie puede llenar la casilla desde el sitio.
//
// Contadores: si hay una base Upstash Redis conectada (variables
// UPSTASH_REDIS_REST_URL/TOKEN o KV_REST_API_URL/TOKEN) se comparten entre
// todas las instancias. Si no, se guardan en la memoria de la instancia, que
// Vercel reinicia cada tanto: sirve contra ráfagas, no es un límite estricto.
const crypto = require('node:crypto');

// Destino de FormSubmit: conviene poner en Vercel la variable FORMSUBMIT_TARGET
// con el código aleatorio que da FormSubmit al activar, en lugar del correo.
const TARGET = process.env.FORMSUBMIT_TARGET || 'ssantillan@alumnos.exa.unicen.edu.ar';

const LIMITS = [
  { name: 'ip-hora', perIp: true, max: 3, window: 60 * 60 },
  { name: 'ip-dia', perIp: true, max: 10, window: 24 * 60 * 60 },
  { name: 'total-dia', perIp: false, max: 60, window: 24 * 60 * 60 } // tope global por si atacan desde muchas IPs
];

const MAX_MESSAGE = 600;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const memory = new Map(); // clave → { count, expires }

// Suma 1 al contador `key` (que vence en `ttl` segundos) y devuelve el total.
async function hit(key, ttl) {
  if (REDIS_URL && REDIS_TOKEN) {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', key, 0, 'EX', ttl, 'NX'], ['INCR', key]])
    });
    if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
    const out = await res.json();
    return out[1].result;
  }
  const now = Date.now();
  for (const [k, v] of memory) if (v.expires <= now) memory.delete(k);
  const entry = memory.get(key) ?? { count: 0, expires: now + ttl * 1000 };
  entry.count++;
  memory.set(key, entry);
  return entry.count;
}

// La IP la pone Vercel en x-forwarded-for (el primer valor es el cliente).
// Se guarda solo un hash, nunca la IP.
function clientId(req) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] || req.socket?.remoteAddress || 'desconocida';
  return crypto.createHash('sha256').update(`automater:${ip}`).digest('hex').slice(0, 24);
}

// Devuelve el límite superado (con los segundos que faltan) o null.
async function checkLimits(id) {
  const now = Math.floor(Date.now() / 1000);
  for (const limit of LIMITS) {
    const bucket = Math.floor(now / limit.window);
    const key = `contacto:${limit.name}:${limit.perIp ? id : 'todos'}:${bucket}`;
    const count = await hit(key, limit.window);
    if (count > limit.max) return { limit, retryAfter: (bucket + 1) * limit.window - now };
  }
  return null;
}

const send = (res, status, body, headers = {}) => {
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.status(status).json(body);
};

const clean = (value, max) => String(value ?? '').replace(/\s+$/g, '').trim().slice(0, max);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { success: false, message: 'Método no permitido.' }, { Allow: 'POST' });

  // Solo se acepta desde la propia página (otros sitios no pueden usar el endpoint)
  const origin = req.headers.origin;
  let originHost = null;
  try { originHost = new URL(origin).host; } catch { /* sin Origin o inválido */ }
  if (!originHost || originHost !== req.headers.host) {
    return send(res, 403, { success: false, message: 'Origen no permitido.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return send(res, 400, { success: false, message: 'Datos inválidos.' });

  const email = clean(body.email, 120);
  const motivo = clean(body.motivo, 80);
  const mensaje = clean(body.mensaje, MAX_MESSAGE);
  if (!EMAIL_RE.test(email)) return send(res, 400, { success: false, field: 'email', message: 'Escribe un correo válido para poder responderte.' });
  if (!motivo) return send(res, 400, { success: false, field: 'motivo', message: 'Indica el motivo del mensaje.' });
  if (mensaje.length < 10) return send(res, 400, { success: false, field: 'mensaje', message: 'El mensaje es muy corto (mínimo 10 caracteres).' });

  let blocked;
  try {
    blocked = await checkLimits(clientId(req));
  } catch (err) {
    console.error('Rate limit:', err);
    return send(res, 503, { success: false, message: 'El contacto no está disponible en este momento. Intenta más tarde.' });
  }
  if (blocked) {
    const minutes = Math.ceil(blocked.retryAfter / 60);
    const when = minutes >= 90 ? `${Math.ceil(minutes / 60)} horas` : `${minutes} minuto${minutes === 1 ? '' : 's'}`;
    return send(res, 429, {
      success: false,
      message: blocked.limit.perIp
        ? `Ya enviaste varios mensajes. Podrás enviar otro en ${when}.`
        : `Se alcanzó el límite de mensajes por hoy. Intenta de nuevo en ${when}.`
    }, { 'Retry-After': String(blocked.retryAfter) });
  }

  // Bots que llenan el campo oculto: se les responde OK sin enviar nada
  if (body._honey) return send(res, 200, { success: true });

  // Solo se reenvían estos campos: nada de _cc, _next, etc. inyectados desde afuera
  const payload = {
    email, motivo, mensaje,
    automata: clean(body.automata, 40),
    dispositivo: clean(body.dispositivo, 300),
    _subject: `[Automater Pro] ${motivo}`,
    _template: 'table',
    _captcha: 'false',
    _replyto: email
  };

  try {
    const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(TARGET)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: origin, Referer: `${origin}/` },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || String(data.success) !== 'true') {
      console.error('FormSubmit:', r.status, data);
      return send(res, 502, { success: false, message: 'No se pudo enviar el mensaje. Intenta de nuevo más tarde.' });
    }
    return send(res, 200, { success: true });
  } catch (err) {
    console.error('FormSubmit:', err);
    return send(res, 502, { success: false, message: 'No se pudo enviar el mensaje. Intenta de nuevo más tarde.' });
  }
};
