// /api/admin?accion=… — panel de la óptica. Requiere la cabecera x-clave = CLAVE_PANEL.
import { randomInt } from 'node:crypto';
import {
  q, ok, error, cuerpo, esAdmin, hayClave, cifrarClave, claveVariable, parametro, urlPublica, nombreMostrar, colaTelefono,
  leerAjustes, completarAjustes, configCorreo, POR_DEFECTO, ESTILOS_SORTEO, TEMAS, errorServidor,
} from './_comun.js';
import { enviarEmailTirada, htmlPremio, smtp } from './_email.js';

// Nombres inventados para rellenar el bombo en los sorteos de PRUEBA (nunca en el real).
const DEMO = ['María García', 'Antonio López', 'Laura Martín', 'Carlos Ruiz', 'Marta Sánchez', 'Javier Gómez', 'Lucía Fernández',
  'David Moreno', 'Elena Jiménez', 'Pablo Díaz', 'Sara Romero', 'Jorge Navarro', 'Paula Torres', 'Álex Domínguez', 'Carmen Vázquez',
  'Sergio Ramos', 'Cristina Gil', 'Raúl Serrano', 'Ana Blanco', 'Miguel Molina', 'Isabel Castro', 'Diego Ortega', 'Nuria Rubio',
  'Iván Marín', 'Alba Sanz', 'Hugo Iglesias', 'Irene Medina', 'Óscar Garrido', 'Noelia Cortés', 'Rubén Castillo', 'Julia Santos',
  'Adrián Lozano', 'Silvia Guerrero', 'Marcos Cano', 'Clara Prieto', 'Daniel Méndez', 'Rocío Cruz', 'Víctor Calvo', 'Eva Gallego', 'Mario Vidal'];

function barajar(lista) {   // Fisher-Yates con el generador criptográfico: de aquí salen los ganadores
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const CAMPOS_PREMIO = ['orden', 'etiqueta', 'nombre', 'detalle', 'tipo', 'peso', 'stock', 'color', 'activo'];
const LARGOS = { texto_privacidad: 8000, clausula_email: 8000, intro: 400 };

function csv(res, nombre, filas) {
  const cabecera = filas.length ? Object.keys(filas[0]) : [];
  const celda = (v) => { const s = v == null ? '' : (v instanceof Date ? v.toISOString() : String(v)); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const texto = '﻿' + [cabecera.join(';'), ...filas.map((f) => cabecera.map((c) => celda(f[c])).join(';'))].join('\n');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  res.end(texto);
}

// Ajustes que se devuelven al panel: nunca la contraseña del correo.
function ajustesParaPanel(a) {
  const copia = JSON.parse(JSON.stringify(a));
  copia.email.tiene_pass = !!(a.email && a.email.pass);
  copia.email.pass = '';
  return copia;
}

// Limpia lo que llega del panel: solo las claves conocidas, con su tipo y longitud.
function limpiarAjustes(entrada, actuales) {
  const salida = {};
  for (const grupo of Object.keys(POR_DEFECTO)) {
    salida[grupo] = {};
    for (const campo of Object.keys(POR_DEFECTO[grupo])) {
      const def = POR_DEFECTO[grupo][campo];
      let v = entrada && entrada[grupo] ? entrada[grupo][campo] : undefined;
      if (v === undefined) { salida[grupo][campo] = actuales[grupo][campo]; continue; }
      if (typeof def === 'boolean') v = v === true;
      else if (typeof def === 'number') { v = v === '' ? def : Number(v); if (!Number.isFinite(v)) v = def; }
      else v = String(v ?? '').trim().slice(0, LARGOS[campo] || 300);
      salida[grupo][campo] = v;
    }
  }
  // La contraseña del correo solo se cambia si se escribe una nueva (o se pide borrarla).
  if (!entrada?.email?.pass) salida.email.pass = entrada?.email?.borrar_pass ? '' : actuales.email.pass;
  if (!ESTILOS_SORTEO.includes(salida.sorteo.estilo)) salida.sorteo.estilo = 'tragaperras';
  if (!TEMAS.includes(salida.aspecto.tema)) salida.aspecto.tema = 'feria';
  if (!/^#[0-9a-f]{6}$/i.test(salida.aspecto.color)) salida.aspecto.color = '#d01e24';
  salida.sorteo.ganadores = Math.max(1, Math.min(5, Math.round(salida.sorteo.ganadores)));
  salida.aspecto.duracion_giro_s = Math.max(5, Math.min(40, salida.aspecto.duracion_giro_s));
  return salida;
}

export default async function handler(req, res) {
  const accion = parametro(req, 'accion');
  const b = req.method === 'POST' ? cuerpo(req) : {};

  // Sin clave: solo se puede preguntar si ya hay una y crear la primera.
  try {
    if (accion === 'estado-clave') return ok(res, { configurada: await hayClave() });
    if (accion === 'crear-clave') {
      if (req.method !== 'POST') return error(res, 405, 'metodo', 'Usa POST');
      if (await hayClave()) return error(res, 409, 'ya_hay_clave', 'El panel ya tiene clave. Entra con ella.');
      const clave = String(b.clave || '');
      if (clave.length < 8) return error(res, 400, 'clave_corta', 'La clave tiene que tener al menos 8 caracteres.');
      const r = await q('update ruleta.ajustes set clave_hash = $1 where id = 1 and clave_hash is null', [cifrarClave(clave)]);
      return r.rowCount ? ok(res, { creada: true }) : error(res, 409, 'ya_hay_clave', 'El panel ya tiene clave. Entra con ella.');
    }
    if (!(await esAdmin(req))) return error(res, 401, 'clave', 'Clave incorrecta');
  } catch (e) {
    return errorServidor(res, 'admin clave', e);
  }

  try {
    switch (accion) {
      case 'resumen': {
        const a = await leerAjustes();
        const premios = (await q(
          `select p.*, (select count(*) from ruleta.tiradas t where t.premio_id = p.id and not t.prueba) as tiradas
             from ruleta.premios p order by orden, id`)).rows;
        const totales = (await q(
          `select (select count(*) from ruleta.participantes where not prueba) as participantes,
                  (select count(*) from ruleta.participantes where not prueba and consentimiento_comercial) as comerciales,
                  (select count(*) from ruleta.tiradas where not prueba) as tiradas,
                  (select count(*) from ruleta.tiradas where not prueba and premio_tipo <> 'repetir' and email_enviado_en is null) as emails_pendientes,
                  (select count(*) from ruleta.tiradas where prueba) as tiradas_prueba,
                  (select count(*) from ruleta.participantes where prueba) as participantes_prueba`)).rows[0];
        const tiradas = (await q(
          `select t.id, t.creado_en, t.premio_nombre, t.premio_tipo, t.codigo, t.email_enviado_en, t.email_error, t.canjeado_en, t.prueba,
                  p.nombre, p.telefono, p.email
             from ruleta.tiradas t left join ruleta.participantes p on p.id = t.participante_id
            order by t.id desc limit 150`)).rows;
        const sorteos = (await q(
          `select id, creado_en, emitido_en, cerrado_en, prueba, estilo, participantes, ganadores
             from ruleta.sorteos order by id desc limit 12`)).rows;
        const correo = configCorreo(a);
        return ok(res, { clave_variable: !!claveVariable(), ajustes: ajustesParaPanel(a), correo: correo ? { origen: correo.origen, from: correo.from } : null, premios, totales, tiradas, sorteos });
      }

      case 'guardar-ajustes': {
        const actuales = completarAjustes((await q('select datos from ruleta.ajustes where id = 1')).rows[0]?.datos);
        const nuevos = limpiarAjustes(b, actuales);
        await q('update ruleta.ajustes set datos = $1::jsonb, actualizado_en = now() where id = 1', [JSON.stringify(nuevos)]);
        return ok(res, { guardado: true });
      }

      case 'cambiar-clave': {
        if (claveVariable()) return error(res, 400, 'clave_variable', 'La clave está puesta en la variable CLAVE_PANEL de Vercel: cámbiala allí (o bórrala para usar la del panel).');
        const nueva = String(b.nueva || '');
        if (nueva.length < 8) return error(res, 400, 'clave_corta', 'La clave tiene que tener al menos 8 caracteres.');
        await q('update ruleta.ajustes set clave_hash = $1 where id = 1', [cifrarClave(nueva)]);
        return ok(res, { cambiada: true });
      }

      case 'logo': {
        // { tipo: 'largo' | 'redondo', imagen: 'data:image/png;base64,…' | null }. El panel ya la reduce.
        const col = b.tipo === 'redondo' ? 'logo_redondo' : 'logo_largo';
        const img = b.imagen == null ? null : String(b.imagen);
        if (img && (!/^data:image\/(png|jpeg|webp);base64,/.test(img) || img.length > 1_500_000)) return error(res, 400, 'logo', 'La imagen tiene que ser PNG, JPG o WebP y de menos de 1 MB.');
        await q(`update ruleta.ajustes set ${col} = $1, logo_version = logo_version + 1, actualizado_en = now() where id = 1`, [img]);
        return ok(res, { hecho: true });
      }

      case 'email-prueba': {
        const a = await leerAjustes();
        const cfg = configCorreo(a);
        if (!cfg) return error(res, 400, 'sin_correo', 'Primero rellena y guarda los datos del correo.');
        const para = String(b.para || a.optica.email || cfg.user).trim();
        try {
          await smtp(cfg).sendMail({
            from: cfg.from, to: para, subject: '[PRUEBA] Así llega el premio de la ruleta',
            html: htmlPremio(a, { nombre: 'Prueba', premio: 'Vale de 10 € (ejemplo)', detalle: 'Esto es un email de prueba enviado desde el panel.', tipo: 'vale', codigo: 'PRUEBA-123456', base: urlPublica(req) }),
          });
          return ok(res, { enviado: true, para });
        } catch (e) {
          return error(res, 400, 'smtp', 'No se ha podido enviar: ' + e.message);
        }
      }

      case 'sorteo': {
        const a = await leerAjustes();
        const prueba = b.prueba === true;
        const n = Math.max(1, Math.min(5, parseInt(b.ganadores, 10) || a.sorteo.ganadores || 1));
        const estilo = ESTILOS_SORTEO.includes(b.estilo) ? b.estilo : a.sorteo.estilo;
        let bombo;
        if (prueba) {
          const deprueba = (await q('select id as participante_id, nombre, telefono, email from ruleta.participantes where prueba')).rows;
          bombo = deprueba.concat(DEMO.map((nombre, i) => ({ participante_id: null, nombre, telefono: '+346000' + String(10000 + i * 137).slice(-5), email: null })));
        } else {
          const reciente = (await q(`select id from ruleta.sorteos where not prueba and creado_en > now() - interval '90 seconds'`)).rows[0];
          if (reciente) return error(res, 409, 'reciente', 'Se acaba de lanzar un sorteo real hace menos de 90 segundos. Espera a que termine.');
          bombo = (await q(
            `select p.id as participante_id, p.nombre, p.telefono, p.email
               from ruleta.participantes p
              where not p.prueba
                and not exists (select 1 from ruleta.sorteos s, jsonb_array_elements(s.ganadores) g
                                 where not s.prueba and (g->>'participante_id')::bigint = p.id)`)).rows;
          if (bombo.length < n) return error(res, 400, 'participantes', `Solo hay ${bombo.length} participantes en el bombo y se piden ${n} ganadores.`);
        }
        const barajado = barajar(bombo);
        const ganadores = barajado.slice(0, n).map((g) => ({ participante_id: g.participante_id, nombre: g.nombre, telefono: g.telefono, email: g.email, mostrar: nombreMostrar(g.nombre), tel: colaTelefono(g.telefono) }));
        const nombres = barajar(barajado.slice(0, 150)).map((g) => nombreMostrar(g.nombre));
        const fila = (await q(
          `insert into ruleta.sorteos (prueba, estilo, participantes, ganadores, nombres)
           values ($1, $2, $3, $4::jsonb, $5::jsonb) returning id`,
          [prueba, estilo, bombo.length, JSON.stringify(ganadores), JSON.stringify(nombres)])).rows[0];
        return ok(res, { id: fila.id, prueba, estilo, participantes: bombo.length, ganadores });
      }
      case 'sorteo-repetir': {
        const estilo = ESTILOS_SORTEO.includes(b.estilo) ? b.estilo : null;
        const r = await q('update ruleta.sorteos set emitido_en = now(), cerrado_en = null, estilo = coalesce($2, estilo) where id = $1', [Number(b.id), estilo]);
        return r.rowCount ? ok(res, { repetido: Number(b.id) }) : error(res, 404, 'sorteo', 'No existe ese sorteo');
      }
      case 'sorteo-cerrar': {
        const r = await q('update ruleta.sorteos set cerrado_en = now() where cerrado_en is null');
        return ok(res, { cerrados: r.rowCount });
      }

      case 'buscar': {
        const texto = String(parametro(req, 'q') || '').trim();
        if (texto.length < 2) return error(res, 400, 'q', 'Escribe al menos 2 caracteres');
        const tiradas = (await q(
          `select t.id, t.creado_en, t.premio_nombre, t.premio_tipo, t.codigo, t.email_enviado_en, t.email_error, t.canjeado_en, t.prueba,
                  p.nombre, p.telefono, p.email
             from ruleta.tiradas t left join ruleta.participantes p on p.id = t.participante_id
            where t.codigo ilike $1 or p.nombre ilike $1 or p.telefono ilike $1 or p.email ilike $1
            order by t.id desc limit 50`, [`%${texto.replace(/\s+/g, '%')}%`])).rows;
        return ok(res, { tiradas, q: texto });
      }

      case 'premio': {
        const id = Number(b.id);
        const sets = [], vals = [];
        for (const c of CAMPOS_PREMIO) if (c in b) { vals.push(b[c] === '' ? null : b[c]); sets.push(`${c} = $${vals.length}`); }
        if (!id || !sets.length) return error(res, 400, 'datos', 'Nada que actualizar');
        vals.push(id);
        await q(`update ruleta.premios set ${sets.join(', ')} where id = $${vals.length}`, vals);
        return ok(res, { actualizado: id });
      }
      case 'premio-nuevo': {
        const r = await q(
          `insert into ruleta.premios (orden, etiqueta, nombre, detalle, tipo, peso, stock, color, activo)
           values (coalesce((select max(orden) + 1 from ruleta.premios), 1), 'NUEVO', 'Premio nuevo', null, 'fisico', 1, null, '#1e6fd9', true) returning id`);
        return ok(res, { id: r.rows[0].id });
      }
      case 'premio-borrar': {
        const id = Number(b.id);
        const usado = (await q('select count(*) as n from ruleta.tiradas where premio_id = $1', [id])).rows[0].n;
        if (usado > 0) { await q('update ruleta.premios set activo = false where id = $1', [id]); return ok(res, { desactivado: id, motivo: 'tiene tiradas' }); }
        await q('delete from ruleta.premios where id = $1', [id]);
        return ok(res, { borrado: id });
      }

      case 'probar': {   // tirada sin participante: la pantalla gira, no descuenta stock ni envía email
        const t = (await q(`select * from ruleta.girar(null, true, 'PRUEBA')`)).rows[0];
        return ok(res, { tirada_id: t.id, premio: t.premio_nombre });
      }
      case 'reenviar':
        return ok(res, await enviarEmailTirada(Number(b.tirada_id), { forzar: true, base: urlPublica(req) }));
      case 'canjear':
        await q('update ruleta.tiradas set canjeado_en = case when $2 then now() else null end where id = $1', [Number(b.tirada_id), b.canjeado === true]);
        return ok(res, { hecho: true });

      case 'borrar-pruebas': {
        const t = await q('delete from ruleta.tiradas where prueba');
        const p = await q('delete from ruleta.participantes where prueba');
        const s = await q('delete from ruleta.sorteos where prueba');
        return ok(res, { tiradas: t.rowCount, participantes: p.rowCount, sorteos: s.rowCount });
      }
      case 'empezar-de-cero': {
        // Para reutilizar la ruleta en otro evento: borra participantes, tiradas y sorteos y repone el
        // stock. Los premios y los ajustes se quedan. Pide escribir BORRAR para evitar sustos.
        if (b.confirmar !== 'BORRAR') return error(res, 400, 'confirmar', 'Escribe BORRAR para confirmar.');
        const t = await q('delete from ruleta.tiradas');
        const s = await q('delete from ruleta.sorteos');
        const p = await q('delete from ruleta.participantes');
        await q('update ruleta.premios set entregados = 0');
        return ok(res, { tiradas: t.rowCount, participantes: p.rowCount, sorteos: s.rowCount });
      }

      case 'participantes.csv': {
        const filas = (await q(
          `select p.id, p.creado_en, p.nombre, p.telefono, p.email, p.consentimiento, p.consentimiento_comercial as acepta_ofertas, p.prueba,
                  (select string_agg(t.premio_nombre || coalesce(' (' || t.codigo || ')', ''), ' | ' order by t.id) from ruleta.tiradas t where t.participante_id = p.id) as premios
             from ruleta.participantes p order by p.id`)).rows;
        return csv(res, 'participantes-ruleta.csv', filas);
      }
      case 'tiradas.csv': {
        const filas = (await q(
          `select t.id, t.creado_en, p.nombre, p.telefono, p.email, t.premio_nombre, t.premio_tipo, t.codigo, t.email_enviado_en, t.email_error, t.canjeado_en, t.prueba
             from ruleta.tiradas t left join ruleta.participantes p on p.id = t.participante_id order by t.id`)).rows;
        return csv(res, 'tiradas-ruleta.csv', filas);
      }
      default:
        return error(res, 400, 'accion', `Acción desconocida: ${accion}`);
    }
  } catch (e) {
    return errorServidor(res, 'admin ' + accion, e);
  }
}
