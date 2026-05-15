import { CUPON_VIGENCIA_MESES } from './ruleta-constants.mjs';

export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function computeValidoHastaISO() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + CUPON_VIGENCIA_MESES);
  return d.toISOString();
}

export function formatValidoHastaHuman(iso) {
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

export function buildEmailHtml({
  premioGanado,
  premioMensaje,
  premioGancho,
  isNoPrize,
  cuponCodigo,
  cuponValidoHastaHuman,
  nombre,
  telefono
}) {
  const datosContactoBlock =
    nombre && telefono
      ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.55;color:#3a3228;font-family:system-ui,sans-serif;text-align:left;">
          <strong>Nombre:</strong> ${esc(nombre)}<br>
          <strong>Teléfono:</strong> ${esc(telefono)}
        </p>`
      : '';
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
              ${datosContactoBlock}
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
