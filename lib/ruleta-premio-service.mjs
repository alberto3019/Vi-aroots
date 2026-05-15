import { Resend } from 'resend';
import {
  ALLOWED_PRIZE_IDS,
  CUPON_VIGENCIA_MESES,
  prizeEmiteCupon
} from './ruleta-constants.mjs';
import {
  buildEmailHtml,
  formatValidoHastaHuman
} from './ruleta-email-html.mjs';
import {
  prepareCuponCode,
  finalizeCuponAfterEmail,
  releaseReservedCupon
} from './cupon-ledger.mjs';

const RULETA_NOTIFY_COPY = 'rodrigo@autonovax.com.ar';

/** @param {unknown} raw */
function normalizeNombre(raw) {
  const s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  if (s.length < 2) return null;
  if (/[<>"]/.test(s)) return null;
  return s;
}

/** @param {unknown} raw */
function normalizeTelefonoRequerido(raw) {
  const s = String(raw ?? '')
    .trim()
    .slice(0, 40);
  if (!s) return null;
  if (!/^[\d+().\s-]+$/.test(s)) return null;
  const digits = s.replace(/\D/g, '');
  if (digits.length < 6) return null;
  return s;
}

/**
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ statusCode: number; body: Record<string, unknown> }>}
 */
export async function executeRuletaPremio(body) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return {
      statusCode: 503,
      body: { ok: false, error: 'Falta RESEND_API_KEY o RESEND_FROM en el entorno.' }
    };
  }

  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  const prizeId = String(body.prizeId || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, body: { ok: false, error: 'Email inválido.' } };
  }
  if (!ALLOWED_PRIZE_IDS.has(prizeId)) {
    return {
      statusCode: 400,
      body: { ok: false, error: 'Identificador de premio no válido.' }
    };
  }

  const nombreNorm = normalizeNombre(body.nombre ?? body.name);
  if (nombreNorm === null) {
    return {
      statusCode: 400,
      body: { ok: false, error: 'Nombre inválido o incompleto (mínimo 2 caracteres).' }
    };
  }

  const telefonoNorm = normalizeTelefonoRequerido(body.telefono ?? body.phone);
  if (telefonoNorm === null) {
    return { statusCode: 400, body: { ok: false, error: 'Teléfono inválido o vacío.' } };
  }

  const premioGanado = String(body.premioGanado || '').slice(0, 500);
  const premioMensaje = String(body.premioMensaje || '').slice(0, 4000);
  const premioGancho = String(body.premioGancho || '').slice(0, 2000);
  const isNoPrize = prizeId === 'sin_premio';

  if (!premioGanado || !premioMensaje) {
    return { statusCode: 400, body: { ok: false, error: 'Faltan datos del premio.' } };
  }

  let cuponCodigo = null;
  let cuponValidoHasta = null;
  let reserveMode = null;

  if (prizeEmiteCupon(prizeId)) {
    const prep = await prepareCuponCode(prizeId, email, telefonoNorm, nombreNorm);
    cuponCodigo = prep.codigo;
    cuponValidoHasta = prep.validoHasta;
    reserveMode = prep.mode;
  }

  const cuponValidoHastaHuman =
    cuponCodigo && cuponValidoHasta ? formatValidoHastaHuman(cuponValidoHasta) : null;

  const html = buildEmailHtml({
    premioGanado,
    premioMensaje,
    premioGancho,
    isNoPrize,
    cuponCodigo,
    cuponValidoHastaHuman,
    nombre: nombreNorm,
    telefono: telefonoNorm
  });

  const subject =
    prizeId === 'sin_premio'
      ? 'Tu participación en la ruleta VinyaRoots'
      : 'Tu premio VinyaRoots — ruleta';

  const resend = new Resend(apiKey);
  const payload = {
    from,
    to: [email],
    subject,
    html
  };
  const bccSet = new Set([RULETA_NOTIFY_COPY.trim().toLowerCase()]);
  const bccEnv = process.env.RULETA_BCC;
  if (bccEnv) {
    bccEnv
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .forEach((addr) => bccSet.add(addr));
  }
  if (bccSet.has(email.toLowerCase())) {
    bccSet.delete(email.toLowerCase());
  }
  const bccArr = Array.from(bccSet);
  if (bccArr.length) payload.bcc = bccArr;

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    console.error('[ruleta-premio] Resend:', error);
    if (cuponCodigo && reserveMode && reserveMode !== 'none') {
      await releaseReservedCupon(cuponCodigo, reserveMode);
    }
    return {
      statusCode: 502,
      body: {
        ok: false,
        error: typeof error === 'string' ? error : error.message || 'Error al enviar con Resend.'
      }
    };
  }

  if (cuponCodigo && cuponValidoHasta && reserveMode && reserveMode !== 'none') {
    const entry = {
      at: new Date().toISOString(),
      nombre: nombreNorm,
      email,
      telefono: telefonoNorm,
      prizeId,
      premioGanado: premioGanado.slice(0, 200),
      codigo: cuponCodigo,
      validoHasta: cuponValidoHasta,
      vigenciaMeses: CUPON_VIGENCIA_MESES,
      codigoUnico: true,
      resendEmailId: data?.id || null
    };
    try {
      await finalizeCuponAfterEmail(entry, reserveMode);
    } catch (e) {
      console.error('[ruleta-premio] persist cupón:', e.message);
    }
  }

  const cuponResp =
    cuponCodigo && cuponValidoHasta
      ? {
          codigo: cuponCodigo,
          validoHasta: cuponValidoHasta,
          vigenciaMeses: CUPON_VIGENCIA_MESES,
          codigoUnico: true
        }
      : null;

  const cuponPersistidoServer =
    cuponResp && reserveMode ? reserveMode !== 'none' : null;

  return {
    statusCode: 200,
    body: {
      ok: true,
      id: data?.id || null,
      cupon: cuponResp,
      cuponPersistidoServer
    }
  };
}
