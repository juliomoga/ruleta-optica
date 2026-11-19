// GET /api/estado — lo consulta la pantalla cada ~800 ms (y el iPad cada pocos segundos): marca,
// gajos activos, la última tirada (si es nueva, la pantalla la anima) y el sorteo si está en marcha.
//
// OJO: es público. Del sorteo solo salen los datos que se ven en la pantalla de la calle: nombre
// abreviado ("MARÍA G.") y tres últimas cifras del teléfono. Nunca nombres completos ni emails.
import { q, ok, completarAjustes, marcaPublica, duracionGiroMs, errorServidor } from './_comun.js';

const iso = (v) => (v ? new Date(v).toISOString() : null);
// Identificador del despliegue: la pantalla se recarga sola cuando cambia.
const VERSION = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'local';
const TIEMPOS = { inicio: 6000, intro: 6000, suspense: 15000, premio: 9000 };   // guion del sorteo (ms)
const TABLERO_MS = 15 * 60 * 1000, TABLERO_PRUEBA_MS = 45 * 1000;              // cuánto quedan los ganadores en pantalla

function sorteoPublico(s, ahora, a) {
  if (!s) return null;
  const ganadores = s.ganadores || [];
  const animacion = TIEMPOS.inicio + TIEMPOS.intro + ganadores.length * (TIEMPOS.suspense + TIEMPOS.premio);
  if (new Date(ahora) - new Date(s.emitido_en) > animacion + (s.prueba ? TABLERO_PRUEBA_MS : TABLERO_MS)) return null;
  return {
    id: s.id, emitido_en: iso(s.emitido_en), estilo: s.estilo, prueba: s.prueba, participantes: s.participantes,
    premio: String(a.sorteo.premio || 'GRAN PREMIO').toLocaleUpperCase('es-ES'),
    tiempos: TIEMPOS,
    ganadores: ganadores.map((g) => ({ mostrar: g.mostrar, tel: g.tel })),
    nombres: s.nombres || [],
  };
}

export default async function handler(req, res) {
  try {
    const r = (await q(
      `select now() as ahora,
              (select row_to_json(x) from (select datos, logo_version, logo_largo is not null as hay_largo, logo_redondo is not null as hay_redondo from ruleta.ajustes where id = 1) x) as ajustes,
              (select coalesce(json_agg(p order by p.orden), '[]'::json)
                 from (select id, orden, etiqueta, color, tipo from ruleta.premios where activo) p) as premios,
              (select row_to_json(t)
                 from (select id, premio_id, creado_en, premio_nombre, premio_tipo, prueba from ruleta.tiradas order by id desc limit 1) t) as ultima,
              (select row_to_json(s)
                 from (select id, emitido_en, estilo, prueba, participantes, ganadores, nombres
                         from ruleta.sorteos where cerrado_en is null order by emitido_en desc limit 1) s) as sorteo`)).rows[0];
    const fila = r.ajustes || {};
    const a = completarAjustes(fila.datos);
    a.logos = { version: fila.logo_version || 0, largo: !!fila.hay_largo, redondo: !!fila.hay_redondo };
    if (r.ultima) r.ultima.creado_en = iso(r.ultima.creado_en);
    return ok(res, {
      ahora: iso(r.ahora), marca: marcaPublica(a), premios: r.premios, ultima: r.ultima,
      duracion_ms: duracionGiroMs(a), tema: a.aspecto.tema, sorteo: sorteoPublico(r.sorteo, r.ahora, a), version: VERSION,
    });
  } catch (e) {
    return errorServidor(res, 'estado', e, 'Error consultando el estado');
  }
}
