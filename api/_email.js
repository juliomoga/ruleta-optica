// Email con el premio. Lo pide el iPad justo después de girar (POST /api/enviar) y se puede
// reenviar desde el panel. Si la óptica no ha configurado el correo, no se envía nada (el iPad
// enseña el premio y el código igualmente) y el panel lo avisa.
import nodemailer from 'nodemailer';
import { q, leerAjustes, configCorreo, urlLogo } from './_comun.js';

let transporter = null, firmaTransporter = '';
export function smtp(cfg) {
  const firma = JSON.stringify([cfg.host, cfg.port, cfg.user, cfg.pass]);
  if (transporter && firma === firmaTransporter) return transporter;
  transporter = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.port === 465, auth: { user: cfg.user, pass: cfg.pass } });
  firmaTransporter = firma;
  return transporter;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function htmlPremio(a, { nombre, premio, detalle, tipo, codigo, base }) {
  const o = a.optica, ev = a.evento, color = a.aspecto.color || '#d01e24';
  const optica = o.nombre || 'nuestra óptica';
  const primerNombre = String(nombre || '').split(' ')[0];
  const donde = `<b>${esc(optica)}</b>${o.direccion ? ` (${esc(o.direccion)})` : ''}`;
  const comoCanjear = tipo === 'vale'
    ? `Enseña este email en ${donde}${ev.validez_vales ? ` antes del <b>${esc(ev.validez_vales)}</b>` : ''} y te lo aplicamos en caja.`
    : `Si no te lo hemos dado ya en el momento, pásate por ${donde} con este email y te lo entregamos.`;
  const logo = urlLogo(a, 'largo');
  const cabecera = logo
    ? `<img src="${base}${logo}" alt="${esc(optica)}" width="240" style="width:240px;max-width:80%;height:auto">`
    : `<div style="font-size:24px;font-weight:800">${esc(optica)}</div>`;
  const contacto = [o.telefono ? `Tel. ${esc(o.telefono)}` : '', o.email ? esc(o.email) : '', o.web ? esc(o.web) : ''].filter(Boolean).join(' · ');
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:12px;overflow:hidden">
  <tr><td style="padding:28px 32px 8px" align="center">${cabecera}</td></tr>
  <tr><td style="padding:8px 32px 0" align="center"><div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#888">${esc(ev.titulo)}</div></td></tr>
  <tr><td style="padding:16px 32px 0" align="center"><div style="font-size:26px;font-weight:700">¡Enhorabuena, ${esc(primerNombre)}!</div>
      <div style="font-size:16px;color:#444;margin-top:6px">Has ganado en la ruleta de ${esc(optica)}:</div></td></tr>
  <tr><td style="padding:20px 32px 0" align="center">
      <div style="background:${esc(color)};color:#fff;border-radius:10px;padding:22px 18px;font-size:24px;font-weight:800;line-height:1.2">${esc(premio)}</div></td></tr>
  ${detalle ? `<tr><td style="padding:14px 32px 0;font-size:15px;color:#444" align="center">${esc(detalle)}</td></tr>` : ''}
  ${codigo ? `<tr><td style="padding:20px 32px 0" align="center"><div style="display:inline-block;border:2px dashed #111;border-radius:8px;padding:10px 18px;font-size:20px;font-weight:700;letter-spacing:.12em">${esc(codigo)}</div></td></tr>` : ''}
  <tr><td style="padding:22px 32px 0;font-size:15px;line-height:1.5;color:#222">${comoCanjear}</td></tr>
  ${a.sorteo.activo && a.sorteo.premio ? `<tr><td style="padding:22px 32px 0">
      <div style="background:#fff8e1;border:2px solid #ffc400;border-radius:10px;padding:16px 18px;font-size:15px;line-height:1.5;color:#222">
        <div style="font-size:17px;font-weight:800;margin-bottom:4px">🎁 Y además entras en el sorteo de ${esc(a.sorteo.premio)}</div>
        Solo por haber jugado ya participas. Haremos el sorteo <b>en directo en la pantalla de la óptica</b>, entre todos los participantes de la ruleta. Si eres uno de los ganadores, nos pondremos en contacto contigo.
      </div></td></tr>` : ''}
  ${o.horario || contacto ? `<tr><td style="padding:18px 32px 0;font-size:14px;line-height:1.5;color:#444">${esc(o.horario)}${o.horario && contacto ? '<br>' : ''}${contacto}</td></tr>` : ''}
  <tr><td style="padding:24px 32px 28px;font-size:15px;color:#222">¡Gracias por jugar!${ev.firma_email ? `<br><b>${esc(ev.firma_email)}</b>` : `<br><b>${esc(optica)}</b>`}</td></tr>
  ${a.legal.clausula_email ? `<tr><td style="padding:16px 32px 24px;font-size:10px;line-height:1.4;color:#999;border-top:1px solid #eee">${esc(a.legal.clausula_email)}</td></tr>` : ''}
</table>
</td></tr></table></body></html>`;
}

// Envía (o reenvía) el email de una tirada. Devuelve { enviado, motivo?, destinatario? }.
export async function enviarEmailTirada(tiradaId, { forzar = false, base } = {}) {
  const t = (await q(
    `select t.id, t.codigo, t.premio_nombre, t.premio_tipo, t.email_enviado_en, t.prueba,
            p.nombre, p.email, pr.detalle
       from ruleta.tiradas t
       left join ruleta.participantes p on p.id = t.participante_id
       left join ruleta.premios pr on pr.id = t.premio_id
      where t.id = $1`, [tiradaId])).rows[0];
  if (!t) return { enviado: false, motivo: 'no_existe' };
  if (t.premio_tipo === 'repetir') return { enviado: false, motivo: 'repetir' };
  if (!t.email) return { enviado: false, motivo: 'sin_participante' };
  if (t.email_enviado_en && !forzar) return { enviado: false, motivo: 'ya_enviado', destinatario: t.email };

  const a = await leerAjustes();
  const cfg = configCorreo(a);
  if (!cfg) {
    await q('update ruleta.tiradas set email_error = $2 where id = $1', [tiradaId, 'Correo sin configurar']);
    return { enviado: false, motivo: 'sin_correo', destinatario: t.email };
  }
  const optica = a.optica.nombre || 'tu óptica';
  const asunto = `${t.prueba ? '[PRUEBA] ' : ''}🎉 ${t.nombre.split(' ')[0]}, tu premio de la ruleta · ${optica}`;
  const html = htmlPremio(a, { nombre: t.nombre, premio: t.premio_nombre, detalle: t.detalle, tipo: t.premio_tipo, codigo: t.codigo, base });
  try {
    await smtp(cfg).sendMail({ from: cfg.from, to: t.email, subject: asunto, html });
    await q('update ruleta.tiradas set email_enviado_en = now(), email_error = null where id = $1', [tiradaId]);
    return { enviado: true, destinatario: t.email };
  } catch (e) {
    await q('update ruleta.tiradas set email_error = $2 where id = $1', [tiradaId, String(e.message).slice(0, 500)]);
    return { enviado: false, motivo: 'error', detalle: e.message, destinatario: t.email };
  }
}
