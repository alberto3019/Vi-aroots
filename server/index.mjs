import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const CUPONES_FILE = path.join(DATA_DIR, 'cupones-emitidos.json');

const ALLOWED_PRIZE_IDS = new Set([
  'bono_oro',
  'bono_plata',
  'bono_bronce',
  'pase_vip',
  'beneficio_plus',
  'pase_fundador',
  'copa_stand',
  'charla_dueno',
  'botella_regalo',
  'sin_premio'
]);

const PRIZE_CODE_PREFIX = {
  bono_oro: 'VR-ORO',
  bono_plata: 'VR-PLA',
  bono_bronce: 'VR-BRO',
  botella_regalo: 'VR-BOT',
  pase_vip: 'VR-VIP',
  beneficio_plus: 'VR-PLUS',
  pase_fundador: 'VR-FUND',
  copa_stand: 'VR-COPA',
  charla_dueno: 'VR-CHAT'
};

const CUPON_VIGENCIA_MESES = 2;

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadCuponesLedger() {
  try {
    if (fs.existsSync(CUPONES_FILE)) {
      const raw = fs.readFileSync(CUPONES_FILE, 'utf8');
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j : [];
    }
  } catch (e) {
    console.error('[cupones] No se pudo leer el ledger:', e.message);
  }
  return [];
}

function appendCuponLedger(entry) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const arr = loadCuponesLedger();
    arr.push(entry);
    fs.writeFileSync(CUPONES_FILE, JSON.stringify(arr, null, 2), 'utf8');
  } catch (e) {
    console.error('[cupones] No se pudo guardar el ledger:', e.message);
  }
}

function existingCodesSet() {
  const set = new Set();
  for (const row of loadCuponesLedger()) {
    if (row && row.codigo) set.add(row.codigo);
  }
  return set;
}

function computeValidoHastaISO() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + CUPON_VIGENCIA_MESES);
  return d.toISOString();
}

function formatValidoHastaHuman(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Argentina/Mendoza'
    });
  } catch (e) {
    return iso;
  }
}

function generateUniqueCouponCode(prizeId) {
  const prefix = PRIZE_CODE_PREFIX[prizeId] || 'VR';
  const used = existingCodesSet();
  for (let attempt = 0; attempt < 12; attempt++) {
    const suffix = randomBytes(5).toString('hex').toUpperCase();
    const codigo = `${prefix}-${suffix}`;
    if (!used.has(codigo)) return codigo;
  }
  return `${prefix}-${randomBytes(8).toString('hex').toUpperCase()}`;
}

function prizeEmiteCupon(prizeId) {
  return prizeId !== 'sin_premio';
}

function buildEmailHtml({
  premioGanado,
  premioMensaje,
  premioGancho,
  isNoPrize,
  cuponCodigo,
  cuponValidoHastaHuman
}) {
  const hookBlock = premioGancho
    ? `<p style="margin:20px 0 0;font-size:15px;line-height:1.55;color:#5c4a3a;font-style:italic;border-top:1px solid #e8dcc4;padding-top:16px;">${esc(
        premioGancho
      )}</p>`
    : '';
  const cuponBlock =
    cuponCodigo && cuponValidoHastaHuman
      ? `<div style="margin:22px 0 0;padding:18px 16px;background:#faf6ef;border:1px dashed #C9A84C;border-radius:10px;text-align:center;">
          <p style="margin:0 0 10px;font-size:11px;color:#6b5c52;text-transform:uppercase;letter-spacing:0.14em;font-family:system-ui,sans-serif;">Código único de canje</p>
          <p style="margin:0;font-size:24px;font-family:ui-monospace,Menlo,Consolas,monospace;color:#3D1010;font-weight:700;letter-spacing:0.04em;">${esc(
            cuponCodigo
          )}</p>
          <p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:#5c4a3a;font-family:system-ui,sans-serif;">Válido hasta el <strong>${esc(
            cuponValidoHastaHuman
          )}</strong> (${CUPON_VIGENCIA_MESES} meses desde la emisión). Este código es único e intransferible.</p>
        </div>`
      : '';
  const titleColor = isNoPrize ? '#6b5c52' : '#3D1010';
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#100606;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#100606;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#F5F0E8;border-radius:12px;overflow:hidden;border:1px solid #C9A84C;">
          <tr>
            <td style="padding:28px 26px 22px;text-align:center;background:linear-gradient(165deg,#1a0c0c 0%,#0d0505 100%);">
              <p style="margin:0;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#C9A84C;font-family:system-ui,sans-serif;">VinyaRoots</p>
              <h1 style="margin:10px 0 0;font-size:22px;font-weight:400;color:#F5F0E8;line-height:1.25;">${
                isNoPrize ? 'Gracias por participar' : 'Tu premio en la ruleta'
              }</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 24px 30px;">
              <p style="margin:0 0 8px;font-size:18px;line-height:1.35;color:${titleColor};font-weight:600;">${esc(
                premioGanado
              )}</p>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#3a3228;">${esc(premioMensaje).replace(
                /\n/g,
                '<br>'
              )}</p>
              ${hookBlock}
              ${cuponBlock}
              <p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#8a7a6a;font-family:system-ui,sans-serif;">
                Las parcelas se otorgan mediante derecho real de superficie por 10 años; vencido el plazo revierten a Viña Roots, según contrato. Premios sujetos a términos de la promoción y contratación. Respondé a este correo o escribinos por WhatsApp si tenés dudas.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const app = express();
app.use(express.json({ limit: '48kb' }));

const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (corsOrigins.length) {
  app.use(cors({ origin: corsOrigins }));
} else {
  app.use(cors({ origin: true }));
}

app.post('/api/ruleta-premio', async (req, res) => {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!apiKey || !from) {
      return res.status(503).json({
        ok: false,
        error: 'Falta RESEND_API_KEY o RESEND_FROM en el servidor (.env).'
      });
    }

    const body = req.body || {};
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const prizeId = String(body.prizeId || '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Email inválido.' });
    }
    if (!ALLOWED_PRIZE_IDS.has(prizeId)) {
      return res.status(400).json({ ok: false, error: 'Identificador de premio no válido.' });
    }

    const premioGanado = String(body.premioGanado || '').slice(0, 500);
    const premioMensaje = String(body.premioMensaje || '').slice(0, 4000);
    const premioGancho = String(body.premioGancho || '').slice(0, 2000);
    const isNoPrize = prizeId === 'sin_premio';

    if (!premioGanado || !premioMensaje) {
      return res.status(400).json({ ok: false, error: 'Faltan datos del premio.' });
    }

    let cuponCodigo = null;
    let cuponValidoHasta = null;
    if (prizeEmiteCupon(prizeId)) {
      cuponCodigo = generateUniqueCouponCode(prizeId);
      cuponValidoHasta = computeValidoHastaISO();
    }

    const cuponValidoHastaHuman =
      cuponCodigo && cuponValidoHasta ? formatValidoHastaHuman(cuponValidoHasta) : null;

    const html = buildEmailHtml({
      premioGanado,
      premioMensaje,
      premioGancho,
      isNoPrize,
      cuponCodigo,
      cuponValidoHastaHuman
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
    const bcc = process.env.RULETA_BCC;
    if (bcc) {
      payload.bcc = bcc.split(',').map((s) => s.trim()).filter(Boolean);
    }

    const { data, error } = await resend.emails.send(payload);
    if (error) {
      console.error('[ruleta-premio] Resend:', error);
      return res.status(502).json({
        ok: false,
        error: typeof error === 'string' ? error : error.message || 'Error al enviar con Resend.'
      });
    }

    if (cuponCodigo && cuponValidoHasta) {
      appendCuponLedger({
        at: new Date().toISOString(),
        email,
        prizeId,
        premioGanado: premioGanado.slice(0, 200),
        codigo: cuponCodigo,
        validoHasta: cuponValidoHasta,
        vigenciaMeses: CUPON_VIGENCIA_MESES,
        codigoUnico: true,
        resendEmailId: data?.id || null
      });
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

    return res.json({ ok: true, id: data?.id || null, cupon: cuponResp });
  } catch (e) {
    console.error('[ruleta-premio]', e);
    return res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
  }
});

app.use(
  express.static(ROOT, {
    extensions: ['html'],
    index: ['vinyaroots.html', 'index.html']
  })
);

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(`VinyaRoots — http://localhost:${PORT} (estático + /api/ruleta-premio)`);
});
