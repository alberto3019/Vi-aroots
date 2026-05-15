/**
 * Cupones: Vercel KV (reserva NX → email → confirmar o liberar).
 * Local sin KV: archivo JSON solo después de email exitoso.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { PRIZE_CODE_PREFIX, CUPON_VIGENCIA_MESES } from './ruleta-constants.mjs';
import { computeValidoHastaISO } from './ruleta-email-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'server', 'data');
const CUPONES_FILE = path.join(DATA_DIR, 'cupones-emitidos.json');

export function hasKvEnv() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function loadFsLedger() {
  try {
    if (fs.existsSync(CUPONES_FILE)) {
      const raw = fs.readFileSync(CUPONES_FILE, 'utf8');
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j : [];
    }
  } catch (e) {
    console.error('[cupones fs]', e.message);
  }
  return [];
}

function fsCodesSet() {
  const set = new Set();
  for (const row of loadFsLedger()) {
    if (row && row.codigo) set.add(row.codigo);
  }
  return set;
}

function appendFs(entry) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const arr = loadFsLedger();
  arr.push(entry);
  fs.writeFileSync(CUPONES_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

/**
 * @param {string} prizeId
 * @param {string} email
 * @param {string} [telefono]
 * @returns {Promise<{ codigo: string, validoHasta: string, mode: 'kv' | 'fs' }>}
 */
export async function prepareCuponCode(prizeId, email, telefono = '') {
  const validoHasta = computeValidoHastaISO();
  const prefix = PRIZE_CODE_PREFIX[prizeId] || 'VR';

  if (hasKvEnv()) {
    const { kv } = await import('@vercel/kv');
    for (let i = 0; i < 28; i++) {
      const codigo = `${prefix}-${randomBytes(5).toString('hex').toUpperCase()}`;
      const key = `vr:codigo:${codigo}`;
      const ok = await kv.set(
        key,
        JSON.stringify({
          _reserved: true,
          email,
          ...(telefono ? { telefono } : {}),
          prizeId,
          at: new Date().toISOString()
        }),
        { nx: true, ex: 60 * 60 * 48 }
      );
      if (ok) return { codigo, validoHasta, mode: 'kv' };
    }
    throw new Error('No se pudo reservar código único (KV).');
  }

  const used = fsCodesSet();
  for (let i = 0; i < 28; i++) {
    const codigo = `${prefix}-${randomBytes(5).toString('hex').toUpperCase()}`;
    if (!used.has(codigo)) return { codigo, validoHasta, mode: 'fs' };
  }
  throw new Error('No se pudo generar código único (FS).');
}

export async function finalizeCuponAfterEmail(entry, mode) {
  if (mode === 'kv') {
    const { kv } = await import('@vercel/kv');
    const key = `vr:codigo:${entry.codigo}`;
    await kv.set(key, JSON.stringify(entry));
    await kv.rpush('vr:cupones:ledger', JSON.stringify(entry));
    return;
  }
  appendFs(entry);
}

export async function releaseReservedCupon(codigo, mode) {
  if (mode === 'kv') {
    try {
      const { kv } = await import('@vercel/kv');
      await kv.del(`vr:codigo:${codigo}`);
    } catch (e) {
      console.error('[cupones] release KV:', e.message);
    }
  }
}

export { CUPONES_FILE, appendFs, loadFsLedger };
