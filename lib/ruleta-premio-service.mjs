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
  hasKvEnv,
  prepareCuponCode,
  finalizeCuponAfterEmail,
  releaseReservedCupon
} from './cupon-ledger.mjs';

const RULETA_NOTIFY_COPY = 'rodrigo@autonovax.com.ar';

/** @param {unknown} raw */
function normalizeTelefonoOpcional(raw) {
  const s = String(raw ?? '')
    .trim()
    .slice(0, 40);
  if (!s) return '';
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

  const telefonoNorm = normalizeTelefonoOpcional(body.telefono ?? body.phone);
  if (telefonoNorm === null) {
    return { statusCode: 400, body: { ok: false, error: 'Teléfono no válido.' } };
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
    if (process.env.VERCEL === '1' && !hasKvEnv()) {
      return {
        statusCode: 503,
        body: {
          ok: false,
          error:
            'En Vercel hace falta Vercel KV: enlazá un store y las variables KV_REST_API_URL y KV_REST_API_TOKEN para no perder cupones.'
        }
      };
    }
    const prep = await prepareCuponCode(prizeId, email, telefonoNorm);
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
    if (cuponCodigo && reserveMode) {
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

  if (cuponCodigo && cuponValidoHasta && reserveMode) {
    const entry = {
      at: new Date().toISOString(),
      email,
      prizeId,
      premioGanado: premioGanado.slice(0, 200),
      codigo: cuponCodigo,
      validoHasta: cuponValidoHasta,
      vigenciaMeses: CUPON_VIGENCIA_MESES,
      codigoUnico: true,
      resendEmailId: data?.id || null
    };
    if (telefonoNorm) entry.telefono = telefonoNorm;
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

  return { statusCode: 200, body: { ok: true, id: data?.id || null, cupon: cuponResp } };
}
