import { executeRuletaPremio } from '../lib/ruleta-premio-service.mjs';

/** Cuerpo JSON: helpers de Vercel o lectura del stream si hace falta. */
async function readJsonBody(req) {
  const b = req.body;
  if (b != null) {
    if (typeof b === 'string') {
      try {
        return b ? JSON.parse(b) : {};
      } catch {
        return {};
      }
    }
    if (Buffer.isBuffer(b)) {
      try {
        const s = b.toString('utf8');
        return s ? JSON.parse(s) : {};
      } catch {
        return {};
      }
    }
    if (typeof b === 'object') return b;
  }
  const chunks = [];
  try {
    for await (const chunk of req) chunks.push(chunk);
  } catch {
    return {};
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length) {
    if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  } else if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  let body = await readJsonBody(req);

  const result = await executeRuletaPremio(body);
  return res.status(result.statusCode).json(result.body);
}
