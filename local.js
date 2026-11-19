// Servidor local para probar la ruleta en tu ordenador sin desplegar: sirve public/ y monta api/*.js
// imitando lo que hace Vercel (req.body y req.query ya parseados).
//   npm run local   →  http://localhost:3210/pantalla  ·  /tablet  ·  /admin
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const PUERTO = Number(process.env.PUERTO || 3210);
const RAIZ = new URL('./public/', import.meta.url).pathname;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const nombre = url.pathname.slice(5).replace(/[^a-z0-9_-]/gi, '');
      const mod = await import(`./api/${nombre}.js?${Date.now()}`); // sin caché: recarga en cada petición
      req.query = Object.fromEntries(url.searchParams);
      let cuerpo = '';
      for await (const c of req) cuerpo += c;
      req.body = cuerpo ? (() => { try { return JSON.parse(cuerpo); } catch { return cuerpo; } })() : undefined;
      return await mod.default(req, res);
    }
    let ruta = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!extname(ruta)) ruta += '.html';                 // cleanUrls como en Vercel
    const fichero = join(RAIZ, ruta);
    if (!fichero.startsWith(RAIZ)) throw Object.assign(new Error('fuera'), { code: 'ENOENT' });
    await stat(fichero);
    res.writeHead(200, { 'Content-Type': MIME[extname(fichero)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(fichero));
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ERR_MODULE_NOT_FOUND') { res.writeHead(404); return res.end('No encontrado'); }
    console.error(e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'servidor', mensaje: e.message }));
  }
}).listen(PUERTO, () => console.log(`Ruleta en local: http://localhost:${PUERTO}/pantalla  ·  /tablet  ·  /admin`));
