// POST /api/girar — el iPad pide una tirada para un participante registrado. El servidor elige el
// premio (ruleta.girar) y la pantalla lo recoge al instante por /api/estado.
// Solo se gira una vez, salvo que la última tirada haya sido "¡Sigue jugando!".
import { cliente, ok, error, metodo, cuerpo, tokenValido, leerAjustes, duracionGiroMs, errorServidor } from './_comun.js';

export default async function handler(req, res) {
  if (!metodo(req, res, 'POST')) return;
  const b = cuerpo(req);
  const id = Number(b.participante_id);
  if (!id || !tokenValido(id, b.token)) return error(res, 403, 'token', 'Sesión no válida. Vuelve a registrarte.');
  let cli;
  try {
    const a = await leerAjustes();
    cli = await cliente();
    const p = (await cli.query('select id, prueba from ruleta.participantes where id = $1', [id])).rows[0];
    if (!p) return error(res, 404, 'participante', 'No encontramos tu registro.');
    const ultima = (await cli.query('select premio_tipo from ruleta.tiradas where participante_id = $1 order by id desc limit 1', [id])).rows[0];
    if (ultima && ultima.premio_tipo !== 'repetir') return error(res, 409, 'ya_giro', 'Ya has girado la ruleta.');
    const prefijo = String(a.evento.prefijo_codigo || 'PREMIO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    const t = (await cli.query('select * from ruleta.girar($1, $2, $3)', [id, p.prueba, prefijo])).rows[0];
    const premio = (await cli.query('select id, orden, etiqueta, nombre, detalle, tipo from ruleta.premios where id = $1', [t.premio_id])).rows[0];
    return ok(res, { tirada_id: t.id, codigo: t.codigo, premio, duracion_ms: duracionGiroMs(a), puede_repetir: premio.tipo === 'repetir' });
  } catch (e) {
    return errorServidor(res, 'girar', e, String(e.message).includes('No quedan premios') ? 'No quedan premios en la ruleta.' : 'No se ha podido girar. Inténtalo de nuevo.');
  } finally {
    if (cli) cli.release();
  }
}
