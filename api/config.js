// GET /api/config — textos y marca que necesita el iPad (privacidad, duración del giro, sorteo).
import { ok, leerAjustes, marcaPublica, textosPrivacidad, duracionGiroMs, errorServidor } from './_comun.js';

export default async function handler(req, res) {
  try {
    const a = await leerAjustes();
    ok(res, {
      marca: marcaPublica(a),
      privacidad: textosPrivacidad(a),
      duracion_giro_ms: duracionGiroMs(a),
      validez_vales: a.evento.validez_vales,
      sorteo: a.sorteo.activo && a.sorteo.premio ? { premio: a.sorteo.premio } : null,
    });
  } catch (e) { errorServidor(res, 'config', e); }
}
