import { executeRuletaPremio } from '../lib/ruleta-premio-service.mjs';

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

  let body = req.body;
  if (body == null || typeof body === 'string') {
    try {
      body = typeof body === 'string' && body ? JSON.parse(body) : {};
    } catch (e) {
      body = {};
    }
  }

  const result = await executeRuletaPremio(body);
  return res.status(result.statusCode).json(result.body);
}
