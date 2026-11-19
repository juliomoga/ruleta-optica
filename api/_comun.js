// Utilidades compartidas por las funciones de la API (Vercel serverless, Node ESM).
import pg from 'pg';
import { createHash, createHmac, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';
import { ESQUEMA_SQL, ESQUEMA_VERSION } from './_esquema.js';

// bigint / numeric llegan como texto: convertirlos a número
pg.types.setTypeParser(20,   (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

// ---------------------------------------------------------------- conexión
// DATABASE_URL la rellena sola la integración de Neon al instalar con el botón de Vercel.
// También valen POSTGRES_URL o SUPABASE_DB_URL (cualquier Postgres; con Supabase, la conexión
// "Transaction pooler", puerto 6543: la directa no funciona desde Vercel).
export function urlConexion() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL || '';
}
let pool = null;
function crearPool() {
  const url = urlConexion();
  if (!url) throw Object.assign(new Error('Falta la variable DATABASE_URL (la base de datos). Instala la ruleta con el botón de la guía o añade la base en Vercel → Storage.'), { codigo: 'sin_base' });
  // sslmode=require en la URL hace que pg exija verificar el certificado, y con algunos proveedores
  // (Supabase) falla: lo quitamos y ciframos igualmente con ssl: { rejectUnauthorized: false }.
  // (sin SSL solo para una base local de pruebas: sslmode=disable o localhost)
  const sinSsl = /sslmode=disable/.test(url) || /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const limpia = url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
  return new pg.Pool({ connectionString: limpia, ssl: sinSsl ? false : { rejectUnauthorized: false }, max: 3, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 8_000 });
}

// La primera consulta de cada arranque comprueba que las tablas existen; si no, las crea.
let preparada = null;
async function instalarSiHaceFalta(p) {
  try {
    const r = await p.query('select esquema_version from ruleta.ajustes where id = 1');
    if (r.rows[0] && r.rows[0].esquema_version >= ESQUEMA_VERSION) return;
  } catch (e) {
    if (e.code !== '42P01' && e.code !== '3F000') throw e;   // tabla o esquema inexistente: instalar
  }
  const c = await p.connect();
  try {
    await c.query('begin');
    await c.query('select pg_advisory_xact_lock(724519)');  // dos arranques a la vez no instalan dos veces
    await c.query(ESQUEMA_SQL);
    await c.query('update ruleta.ajustes set esquema_version = $1 where id = 1', [ESQUEMA_VERSION]);
    await c.query('commit');
    console.log('Esquema de la ruleta instalado (versión ' + ESQUEMA_VERSION + ')');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
async function listo() {
  if (!pool) pool = crearPool();
  if (!preparada) preparada = instalarSiHaceFalta(pool).catch((e) => { preparada = null; throw e; });
  await preparada;
  return pool;
}
export async function q(sql, params) { return (await listo()).query(sql, params); }
export async function cliente() { return (await listo()).connect(); }

// ---------------------------------------------------------------- ajustes
// Lo que no haya guardado la óptica sale de aquí.
export const POR_DEFECTO = {
  optica: { nombre: '', direccion: '', telefono: '', email: '', web: '', horario: '' },
  legal: {
    razon_social: '', cif: '', direccion: '', email_derechos: '', dpo: '',
    texto_privacidad: '',     // si se rellena, sustituye al texto que genera la app
    clausula_email: '',       // pie legal del email (opcional)
  },
  evento: {
    titulo: 'Ruleta de premios',
    subtitulo: '',                                   // debajo del logo en la pantalla (p. ej. "FERIA 2026")
    intro: '¡Todos ganan! Regístrate y gira la ruleta. Una tirada por persona.',
    validez_vales: '',                               // p. ej. "31 de diciembre de 2026"
    prefijo_codigo: 'PREMIO',                        // los códigos salen como PREMIO-3F9A2C
    firma_email: '',                                 // p. ej. "Ana López · Óptica Ejemplo"
  },
  sorteo: { activo: false, premio: '', ganadores: 1, estilo: 'tragaperras' },
  aspecto: { tema: 'feria', color: '#d01e24', duracion_giro_s: 25, invertir_logo: false },   // invertir: logo negro → blanco en la pantalla (fondo negro)
  email: { host: '', port: 587, user: '', pass: '', from: '' },
};
export const ESTILOS_SORTEO = ['tragaperras', 'eliminacion', 'letras'];
export const TEMAS = ['feria', 'marca', 'oro'];

function mezclar(base, extra) {
  const r = {};
  for (const k of Object.keys(base)) {
    const b = base[k], e = extra ? extra[k] : undefined;
    r[k] = b && typeof b === 'object' && !Array.isArray(b) ? mezclar(b, e) : (e === undefined || e === null ? b : e);
  }
  return r;
}
export function completarAjustes(datos) { return mezclar(POR_DEFECTO, datos || {}); }

export async function leerAjustes() {
  const r = (await q('select datos, logo_version, logo_largo is not null as hay_largo, logo_redondo is not null as hay_redondo from ruleta.ajustes where id = 1')).rows[0] || {};
  const a = completarAjustes(r.datos);
  a.logos = { version: r.logo_version || 0, largo: !!r.hay_largo, redondo: !!r.hay_redondo };
  return a;
}

// Correo: las variables SMTP_* de Vercel mandan sobre lo guardado en el panel.
export function configCorreo(a) {
  const e = process.env;
  if (e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS) {
    return { host: e.SMTP_HOST, port: parseInt(e.SMTP_PORT || '587', 10), user: e.SMTP_USER, pass: e.SMTP_PASS, from: e.MAIL_FROM || e.SMTP_USER, origen: 'variables' };
  }
  const m = a.email || {};
  if (m.host && m.user && m.pass) return { host: m.host, port: parseInt(m.port || 587, 10), user: m.user, pass: m.pass, from: m.from || m.user, origen: 'panel' };
  return null;
}

export const urlLogo = (a, tipo) => (a.logos && a.logos[tipo] ? `/api/logo?tipo=${tipo}&v=${a.logos.version}` : null);

// Datos de marca que necesitan la pantalla y el iPad (todo público).
export function marcaPublica(a) {
  return {
    nombre: a.optica.nombre || 'Tu óptica',
    titulo: a.evento.titulo,
    subtitulo: a.evento.subtitulo,
    intro: a.evento.intro,
    color: /^#[0-9a-f]{6}$/i.test(a.aspecto.color) ? a.aspecto.color : '#d01e24',
    logo_largo: urlLogo(a, 'largo'),
    logo_redondo: urlLogo(a, 'redondo'),
    invertir_logo: a.aspecto.invertir_logo === true,
  };
}

export function duracionGiroMs(a) {
  const s = Number(a.aspecto.duracion_giro_s);
  return Math.round(Math.max(5, Math.min(40, Number.isFinite(s) ? s : 25)) * 1000);
}

// Textos de privacidad que ve y acepta el participante en el iPad.
export function textosPrivacidad(a) {
  const o = a.optica, l = a.legal, nombre = o.nombre || 'la óptica';
  const responsable = l.razon_social || nombre;
  const derechos = l.email_derechos || o.email || '[email de la óptica]';
  const sorteo = a.sorteo.activo;
  const resumen = `He leído la información sobre protección de datos y acepto participar en la ruleta${sorteo ? ' y en el sorteo final' : ''} de ${nombre}.`;
  const comercial = `Quiero recibir ofertas y novedades de ${nombre} por email, WhatsApp o teléfono (opcional).`;
  const completo = l.texto_privacidad ? l.texto_privacidad : [
    `Responsable: ${responsable}${l.cif ? `, CIF ${l.cif}` : ''}${l.direccion || o.direccion ? `, ${l.direccion || o.direccion}` : ''}${o.telefono ? `, tel. ${o.telefono}` : ''}, ${derechos}.`,
    l.dpo ? `Delegado de Protección de Datos: ${l.dpo}.` : '',
    `Finalidad: gestionar tu participación en la ruleta de premios${sorteo ? ' y en el sorteo final' : ''} y enviarte el premio por email. Si marcas la casilla de ofertas, también enviarte comunicaciones comerciales de ${nombre} por email, WhatsApp o teléfono.`,
    sorteo ? 'El sorteo se hace en directo en la pantalla de la óptica: tu nombre de pila, la inicial de tu apellido y las tres últimas cifras de tu teléfono podrán mostrarse en ella.' : '',
    'Legitimación: tu consentimiento, que puedes retirar en cualquier momento.',
    'Conservación: los datos de la ruleta, mientras dure la promoción y el canje de los premios; los de las comunicaciones comerciales, hasta que retires el consentimiento. Después, durante los plazos legales.',
    'Destinatarios: no se cederán datos a terceros salvo obligación legal.',
    `Derechos: puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a ${derechos}, y reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).`,
  ].filter(Boolean).join(' ');
  return { resumen, comercial, completo };
}

// ---------------------------------------------------------------- respuestas
export function responder(res, status, cuerpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(cuerpo));
}
export const ok    = (res, cuerpo)                  => responder(res, 200, cuerpo);
export const error = (res, status, codigo, mensaje) => responder(res, status, { error: codigo, mensaje });

// Error del servidor con un mensaje que la óptica pueda entender.
export function errorServidor(res, donde, e, mensajePublico) {
  console.error(donde, e);
  if (e && e.codigo === 'sin_base') return error(res, 500, 'sin_base', e.message);
  if (e && /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout|password authentication|Tenant or user not found|ENETUNREACH/i.test(String(e.message))) {
    return error(res, 500, 'base', 'No se puede conectar con la base de datos. Revisa en Vercel → Storage que la base está creada y conectada al proyecto (variable DATABASE_URL) y vuelve a desplegar.');
  }
  return error(res, 500, 'servidor', mensajePublico || (e && e.message) || 'Error');
}

export function cuerpo(req) {
  const b = req.body;
  if (b == null) return {};
  if (typeof b === 'string') { try { return JSON.parse(b); } catch { return {}; } }
  return b;
}
export function metodo(req, res, permitido) {
  if (req.method === permitido) return true;
  res.setHeader('Allow', permitido);
  error(res, 405, 'metodo', `Usa ${permitido}`);
  return false;
}
export const parametro = (req, nombre) => (req.query && req.query[nombre]) || new URL(req.url, 'http://x').searchParams.get(nombre);

// ---------------------------------------------------------------- seguridad
function igual(a, b) {
  const A = Buffer.from(String(a || '')), B = Buffer.from(String(b || ''));
  return A.length === B.length && A.length > 0 && timingSafeEqual(A, B);
}
// La clave del panel la crea la óptica la primera vez que entra en /admin y se guarda cifrada
// (scrypt) en ruleta.ajustes.clave_hash. Si se pone la variable CLAVE_PANEL en Vercel, manda ella:
// así se recupera el panel si se olvida la clave.
export const claveVariable = () => process.env.CLAVE_PANEL || process.env.RULETA_ADMIN_CLAVE || '';
// Secreto para firmar la sesión del iPad. No hace falta otra variable: sale de la conexión a la base.
function secreto() {
  return process.env.RULETA_SECRETO || createHash('sha256').update('ruleta|' + urlConexion()).digest('hex');
}
export function tokenParticipante(id) {
  return createHmac('sha256', secreto()).update(`p:${id}`).digest('hex').slice(0, 32);
}
export const tokenValido = (id, token) => igual(tokenParticipante(id), token);

export function cifrarClave(clave) {
  const sal = randomBytes(16);
  return 'scrypt$' + sal.toString('hex') + '$' + scryptSync(String(clave), sal, 32).toString('hex');
}
function claveCorrecta(clave, hash) {
  const m = /^scrypt\$([0-9a-f]+)\$([0-9a-f]+)$/.exec(hash || '');
  if (!m || !clave) return false;
  const calc = scryptSync(String(clave), Buffer.from(m[1], 'hex'), 32);
  const guardado = Buffer.from(m[2], 'hex');
  return calc.length === guardado.length && timingSafeEqual(calc, guardado);
}
// ¿Hay clave creada? (o variable CLAVE_PANEL)
export async function hayClave() {
  if (claveVariable()) return true;
  return !!(await q('select clave_hash from ruleta.ajustes where id = 1')).rows[0]?.clave_hash;
}
export async function esAdmin(req) {
  const dada = req.headers['x-clave'] || parametro(req, 'clave');
  if (!dada) return false;
  if (claveVariable()) return igual(claveVariable(), dada);
  const hash = (await q('select clave_hash from ruleta.ajustes where id = 1')).rows[0]?.clave_hash;
  return claveCorrecta(dada, hash);
}

// ---------------------------------------------------------------- validación
// Teléfonos de España sin prefijo (6XX…) pasan a +34; también admite internacionales con + o 00.
export function normalizarTelefono(t) {
  let s = String(t || '').trim().replace(/[\s\-.()]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (/^[6789]\d{8}$/.test(s)) s = '+34' + s;
  else if (/^34[6789]\d{8}$/.test(s)) s = '+' + s;
  return /^\+\d{9,15}$/.test(s) ? s : null;
}
export function emailValido(e) {
  const s = String(e || '').trim();
  return s.length <= 120 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s) ? s.toLowerCase() : null;
}
export function nombreValido(n) {
  const s = String(n || '').trim().replace(/\s+/g, ' ');
  return s.length >= 2 && s.length <= 80 ? s : null;
}

// Cómo sale un participante en la pantalla del sorteo (dato público):
// "María García López" → "MARÍA G." y "···456". Nunca el apellido entero ni el teléfono.
const PARTICULAS = /^(de|del|la|las|los|y|i|da|do|dos|van|von|d'|l')$/i;
export function nombreMostrar(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '···';
  const pila = partes[0].slice(0, 12);
  const resto = partes.slice(1).filter((w) => !PARTICULAS.test(w));
  return (pila + (resto.length ? ` ${resto[0][0]}.` : '')).toLocaleUpperCase('es-ES');
}
export function colaTelefono(telefono) {
  const cifras = String(telefono || '').replace(/\D/g, '');
  return cifras.length >= 3 ? '···' + cifras.slice(-3) : '';
}

// ---------------------------------------------------------------- petición
export function ipCliente(req) {
  const xf = req.headers['x-forwarded-for'];
  return (Array.isArray(xf) ? xf[0] : (xf || '')).split(',')[0].trim() || req.socket?.remoteAddress || null;
}
export function urlPublica(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}
