// GET /api/logo?tipo=largo|redondo&v=N — sirve el logo que la óptica subió en el panel.
// La URL lleva la versión, así que se puede cachear para siempre.
import { q, parametro, error, errorServidor } from './_comun.js';

export default async function handler(req, res) {
  const tipo = parametro(req, 'tipo') === 'redondo' ? 'logo_redondo' : 'logo_largo';
  try {
    const fila = (await q(`select ${tipo} as img from ruleta.ajustes where id = 1`)).rows[0];
    const m = fila && fila.img && /^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,(.+)$/.exec(fila.img);
    if (!m) return error(res, 404, 'logo', 'Sin logo');
    res.statusCode = 200;
    res.setHeader('Content-Type', m[1]);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(Buffer.from(m[2], 'base64'));
  } catch (e) { errorServidor(res, 'logo', e); }
}
