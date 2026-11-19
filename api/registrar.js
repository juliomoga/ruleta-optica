// POST /api/registrar — el iPad da de alta al participante.
// Devuelve { participante_id, token, nombre }. Si el teléfono ya jugó: 409 ya_participo.
import { q, ok, error, metodo, cuerpo, tokenParticipante, normalizarTelefono, emailValido, nombreValido, ipCliente, leerAjustes, textosPrivacidad, errorServidor } from './_comun.js';

export default async function handler(req, res) {
  if (!metodo(req, res, 'POST')) return;
  const b = cuerpo(req);
  const nombre   = nombreValido(b.nombre);
  const telefono = normalizarTelefono(b.telefono);
  const email    = emailValido(b.email);
  if (!nombre)   return error(res, 400, 'nombre',   'Escribe tu nombre.');
  if (!telefono) return error(res, 400, 'telefono', 'El teléfono no parece correcto.');
  if (!email)    return error(res, 400, 'email',    'El email no parece correcto.');
  if (b.consentimiento !== true) return error(res, 400, 'consentimiento', 'Tienes que aceptar la información de protección de datos.');
  const firma = typeof b.firma === 'string' && b.firma.startsWith('data:image/png;base64,') && b.firma.length < 400_000 ? b.firma : null;
  if (!firma) return error(res, 400, 'firma', 'Firma en el recuadro, por favor.');
  const prueba = b.prueba === true;
  const comercial = b.comercial === true;

  try {
    const t = textosPrivacidad(await leerAjustes());
    const texto = `${t.resumen}\n${comercial ? '[✓] ' + t.comercial : '[ ] ' + t.comercial}\n\n${t.completo}`;
    const { rows } = await q(
      `insert into ruleta.participantes (nombre, telefono, email, consentimiento, consentimiento_comercial, consentimiento_en, consentimiento_texto, firma, ip, user_agent, prueba)
       values ($1, $2, $3, true, $4, now(), $5, $6, $7, $8, $9) returning id`,
      [nombre, telefono, email, comercial, texto, firma, ipCliente(req), String(req.headers['user-agent'] || '').slice(0, 300), prueba]);
    const id = rows[0].id;
    return ok(res, { participante_id: id, token: tokenParticipante(id), nombre });
  } catch (e) {
    if (e.code === '23505') return error(res, 409, 'ya_participo', 'Este teléfono ya ha participado en la ruleta. ¡Solo se puede jugar una vez!');
    return errorServidor(res, 'registrar', e, 'No se ha podido registrar. Inténtalo de nuevo.');
  }
}
