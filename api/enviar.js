// POST /api/enviar — envía el email del premio de una tirada. Lo llama el iPad nada más girar
// (con el token del participante) o el panel (con la clave, forzando el reenvío).
import { q, ok, error, metodo, cuerpo, tokenValido, esAdmin, urlPublica, errorServidor } from './_comun.js';
import { enviarEmailTirada } from './_email.js';

export default async function handler(req, res) {
  if (!metodo(req, res, 'POST')) return;
  const b = cuerpo(req);
  const tiradaId = Number(b.tirada_id);
  if (!tiradaId) return error(res, 400, 'tirada', 'Falta tirada_id');
  try {
    const admin = esAdmin(req);
    if (!admin) {
      const t = (await q('select participante_id from ruleta.tiradas where id = $1', [tiradaId])).rows[0];
      if (!t || !t.participante_id || !tokenValido(t.participante_id, b.token)) return error(res, 403, 'token', 'Sesión no válida.');
    }
    return ok(res, await enviarEmailTirada(tiradaId, { forzar: admin && b.forzar === true, base: urlPublica(req) }));
  } catch (e) { errorServidor(res, 'enviar', e); }
}
