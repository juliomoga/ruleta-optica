// Esquema de la base de datos. La app lo instala SOLA la primera vez que arranca (y lo actualiza
// si cambia ESQUEMA_VERSION): la óptica no tiene que ejecutar nada en la base.
// Todo va en un esquema propio `ruleta`, fuera de `public` (si la base es de Supabase, así su API
// pública no lo expone). RLS activada y sin políticas: solo entra la app con su conexión.

export const ESQUEMA_VERSION = 1;

export const ESQUEMA_SQL = `
create schema if not exists ruleta;

-- Ajustes de la óptica (una sola fila): datos, textos legales, aspecto, correo y logos.
create table if not exists ruleta.ajustes (
  id              int primary key default 1 check (id = 1),
  datos           jsonb not null default '{}',
  logo_largo      text,                 -- imagen en data URL (se sirve por /api/logo)
  logo_redondo    text,
  logo_version    int  not null default 0,
  esquema_version int  not null default 0,
  actualizado_en  timestamptz not null default now()
);
insert into ruleta.ajustes (id) values (1) on conflict (id) do nothing;

-- Participantes: los contactos que se registran en el iPad.
create table if not exists ruleta.participantes (
  id                       bigserial primary key,
  creado_en                timestamptz not null default now(),
  nombre                   text not null,
  telefono                 text not null,          -- normalizado: +34612345678
  email                    text not null,
  consentimiento           boolean not null default false,   -- acepta la información de privacidad (obligatorio)
  consentimiento_comercial boolean not null default false,   -- acepta recibir ofertas (opcional)
  consentimiento_en        timestamptz,
  consentimiento_texto     text,                   -- texto exacto que aceptó
  firma                    text,                   -- firma con el dedo (PNG en data URL)
  ip                       text,
  user_agent               text,
  prueba                   boolean not null default false,
  notas                    text
);
-- Un teléfono solo juega una vez (los registros de prueba no cuentan).
create unique index if not exists participantes_telefono_unico on ruleta.participantes (telefono) where not prueba;

-- Premios: los gajos de la ruleta.
create table if not exists ruleta.premios (
  id          serial primary key,
  orden       int  not null,                 -- posición en la rueda (sentido horario desde arriba)
  etiqueta    text not null,                 -- texto corto del gajo; "|" lo parte en dos líneas
  nombre      text not null,                 -- nombre completo (iPad y email)
  detalle     text,                          -- condiciones
  tipo        text not null check (tipo in ('fisico','vale','repetir')),
  peso        numeric not null default 1 check (peso >= 0),   -- probabilidad relativa
  stock       int,                           -- null = sin límite
  entregados  int  not null default 0,
  color       text not null default '#d01e24',
  activo      boolean not null default true
);

-- Tiradas: cada giro.
create table if not exists ruleta.tiradas (
  id               bigserial primary key,
  creado_en        timestamptz not null default now(),
  participante_id  bigint references ruleta.participantes(id) on delete cascade,  -- null en las de prueba del panel
  premio_id        int not null references ruleta.premios(id),
  premio_nombre    text not null,
  premio_tipo      text not null,
  codigo           text unique,
  email_enviado_en timestamptz,
  email_error      text,
  canjeado_en      timestamptz,
  prueba           boolean not null default false
);
create index if not exists tiradas_ultimas      on ruleta.tiradas (id desc);
create index if not exists tiradas_participante on ruleta.tiradas (participante_id);

-- Sorteo final entre todos los participantes (lo lanza la óptica desde el panel).
create table if not exists ruleta.sorteos (
  id            bigserial primary key,
  creado_en     timestamptz not null default now(),
  prueba        boolean not null default false,
  estilo        text not null default 'tragaperras',
  participantes int  not null,
  ganadores     jsonb not null,               -- [{participante_id, nombre, telefono, email, mostrar, tel}]
  nombres       jsonb not null default '[]',  -- nombres abreviados para la animación
  emitido_en    timestamptz not null default now(),
  cerrado_en    timestamptz
);
create index if not exists sorteos_ultimos on ruleta.sorteos (emitido_en desc);

alter table ruleta.ajustes       enable row level security;
alter table ruleta.participantes enable row level security;
alter table ruleta.premios       enable row level security;
alter table ruleta.tiradas       enable row level security;
alter table ruleta.sorteos       enable row level security;

-- Elige un premio al azar según los pesos (entre los activos con stock), descuenta el stock y
-- guarda la tirada, todo con los premios bloqueados: dos tiradas a la vez nunca dan uno de más.
create or replace function ruleta.girar(p_participante bigint, p_prueba boolean, p_prefijo text)
returns ruleta.tiradas
language plpgsql
as $$
declare
  v_fila    ruleta.premios;
  v_elegido ruleta.premios;
  v_total   numeric;
  v_r       numeric;
  v_acum    numeric := 0;
  v_tirada  ruleta.tiradas;
  v_codigo  text;
begin
  perform 1 from ruleta.premios for update;
  select coalesce(sum(peso), 0) into v_total from ruleta.premios
   where activo and peso > 0 and (stock is null or entregados < stock);
  if v_total <= 0 then
    raise exception 'No quedan premios disponibles en la ruleta';
  end if;
  v_r := random() * v_total;
  for v_fila in select * from ruleta.premios
                 where activo and peso > 0 and (stock is null or entregados < stock) order by orden loop
    v_elegido := v_fila;
    v_acum := v_acum + v_fila.peso;
    exit when v_r < v_acum;
  end loop;
  if not p_prueba and v_elegido.tipo <> 'repetir' then
    update ruleta.premios set entregados = entregados + 1 where id = v_elegido.id;
  end if;
  v_codigo := case when v_elegido.tipo = 'repetir' then null
              else coalesce(nullif(p_prefijo, ''), 'PREMIO') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)) end;
  insert into ruleta.tiradas (participante_id, premio_id, premio_nombre, premio_tipo, codigo, prueba)
  values (p_participante, v_elegido.id, v_elegido.nombre, v_elegido.tipo, v_codigo, p_prueba)
  returning * into v_tirada;
  return v_tirada;
end
$$;

-- Premios de ejemplo (solo si no hay ninguno). Se cambian desde el panel.
insert into ruleta.premios (orden, etiqueta, nombre, detalle, tipo, peso, stock, color)
select * from (values
  ( 1, 'GAMUZA',          'Gamuza de microfibra',                     'Recógela en el momento.',                                  'fisico',  20, null::int, '#e0201f'),
  ( 2, 'VALE|10 €',       'Vale de 10 € en gafas de sol',             'Válido en gafas de sol a partir de 60 €. No acumulable.',  'vale',     8, null, '#1e6fd9'),
  ( 3, 'SPRAY',           'Spray limpiagafas',                        'Recógelo en el momento.',                                  'fisico',  18, null, '#ffc400'),
  ( 4, '¡SIGUE|JUGANDO!', '¡Sigue jugando!',                          'Tienes otra tirada.',                                      'repetir',  8, null, '#f2f2f2'),
  ( 5, 'CORDÓN',          'Cordón para gafas',                        'Recógelo en el momento.',                                  'fisico',  15, null, '#1db954'),
  ( 6, 'VALE|20 €',       'Vale de 20 € en gafas graduadas',          'Válido en gafas graduadas completas. No acumulable.',      'vale',     5, null, '#8e3fd9'),
  ( 7, 'FUNDA',           'Funda de gafas',                           'Recógela en el momento.',                                  'fisico',  12, null, '#ff7a00'),
  ( 8, '-20 %|LENTILLAS', 'Descuento del 20 % en lentes de contacto', 'Válido en una compra de lentes de contacto. No acumulable.','vale',     4, null, '#00c2d1')
) as v(orden, etiqueta, nombre, detalle, tipo, peso, stock, color)
where not exists (select 1 from ruleta.premios);
`;
