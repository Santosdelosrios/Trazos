-- ============================================================
-- Cierre de Clase MVP — Migración Inicial
-- Base de datos: Supabase (PostgreSQL)
-- ============================================================

-- Extensión para generar UUIDs
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

create type materia_enum as enum (
  'matematica',
  'lengua',
  'cs_naturales',
  'cs_sociales',
  'otro'
);

create type nivel_comprension_enum as enum (
  'no_entendio',
  'en_proceso',
  'lo_entendio',
  'puede_explicarlo'
);

-- ============================================================
-- TABLA: maestras
-- Extiende el usuario de Supabase Auth (auth.users)
-- ============================================================

create table public.maestras (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  email       text unique not null,
  telefono    text,
  created_at  timestamptz default now() not null
);

comment on table public.maestras is 'Perfil de la maestra. El id referencia a auth.users para vincular con Supabase Auth.';

-- ============================================================
-- TABLA: alumnos
-- ============================================================

create table public.alumnos (
  id          uuid primary key default uuid_generate_v4(),
  maestra_id  uuid not null references public.maestras(id) on delete cascade,
  nombre      text not null,
  apellido    text not null,
  grado       smallint not null check (grado between 1 and 7),
  notas       text,
  created_at  timestamptz default now() not null
);

comment on table public.alumnos is 'Alumnos registrados por cada maestra. Grado 1-7 corresponde a primaria argentina.';
comment on column public.alumnos.grado is '1 a 7: grados de primaria en Argentina.';

create index idx_alumnos_maestra on public.alumnos(maestra_id);

-- ============================================================
-- TABLA: clases
-- ============================================================

create table public.clases (
  id                  uuid primary key default uuid_generate_v4(),
  maestra_id          uuid not null references public.maestras(id) on delete cascade,
  tema                text not null,
  materia             materia_enum not null,
  grado_target        smallint not null check (grado_target between 1 and 7),
  ejercicio_generado  jsonb,
  fecha               timestamptz not null default now(),
  created_at          timestamptz default now() not null
);

comment on table public.clases is 'Registro de cada clase dictada. Soporta clases individuales y grupales via clase_alumnos.';
comment on column public.clases.ejercicio_generado is 'JSON con la respuesta cruda de Gemini: consigna, opciones, respuesta_correcta, explicacion.';

create index idx_clases_maestra on public.clases(maestra_id);
create index idx_clases_fecha on public.clases(fecha desc);

-- ============================================================
-- TABLA: clase_alumnos (pivot)
-- Vincula alumnos con clases. Permite 1:1 y grupales.
-- ============================================================

create table public.clase_alumnos (
  id                      uuid primary key default uuid_generate_v4(),
  clase_id                uuid not null references public.clases(id) on delete cascade,
  alumno_id               uuid not null references public.alumnos(id) on delete cascade,
  respuesta_seleccionada  text,
  respuesta_correcta      boolean,
  autoevaluacion          smallint check (autoevaluacion between 1 and 4),
  respondido_at           timestamptz,

  unique (clase_id, alumno_id)
);

comment on table public.clase_alumnos is 'Tabla pivot: vincula alumnos a clases y almacena sus respuestas al ejercicio de cierre.';
comment on column public.clase_alumnos.autoevaluacion is 'Escala visual 1-4: 1=😟 no entendí, 2=😐 más o menos, 3=😊 lo entendí, 4=🌟 puedo explicarlo.';

create index idx_clase_alumnos_clase on public.clase_alumnos(clase_id);
create index idx_clase_alumnos_alumno on public.clase_alumnos(alumno_id);

-- ============================================================
-- TABLA: hitos_aprendizaje
-- Datos derivados / análisis de la IA sobre cada respuesta
-- ============================================================

create table public.hitos_aprendizaje (
  id                uuid primary key default uuid_generate_v4(),
  clase_alumno_id   uuid unique not null references public.clase_alumnos(id) on delete cascade,
  nivel_comprension nivel_comprension_enum not null,
  resumen_ia        text not null,
  metadata          jsonb default '{}'::jsonb,
  created_at        timestamptz default now() not null
);

comment on table public.hitos_aprendizaje is 'Hito generado por la IA tras el cierre de clase. Relación 1:1 con clase_alumnos.';
comment on column public.hitos_aprendizaje.resumen_ia is 'Síntesis generada por Gemini sobre el desempeño del alumno en esta clase.';
comment on column public.hitos_aprendizaje.metadata is 'Datos extra para futuro análisis: tiempo de respuesta, intentos, etc.';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada maestra solo puede ver y modificar sus propios datos.
-- ============================================================

alter table public.maestras enable row level security;
alter table public.alumnos enable row level security;
alter table public.clases enable row level security;
alter table public.clase_alumnos enable row level security;
alter table public.hitos_aprendizaje enable row level security;

-- Maestras: solo pueden ver/editar su propio perfil
create policy "maestras_own_data" on public.maestras
  for all using (id = auth.uid());

-- Alumnos: solo los de la maestra autenticada
create policy "alumnos_own_maestra" on public.alumnos
  for all using (maestra_id = auth.uid());

-- Clases: solo las de la maestra autenticada
create policy "clases_own_maestra" on public.clases
  for all using (maestra_id = auth.uid());

-- Clase_alumnos: solo si la clase pertenece a la maestra autenticada
create policy "clase_alumnos_own_maestra" on public.clase_alumnos
  for all using (
    exists (
      select 1 from public.clases
      where clases.id = clase_alumnos.clase_id
        and clases.maestra_id = auth.uid()
    )
  );

-- Hitos: solo si el clase_alumno pertenece a una clase de la maestra autenticada
create policy "hitos_own_maestra" on public.hitos_aprendizaje
  for all using (
    exists (
      select 1 from public.clase_alumnos
      join public.clases on clases.id = clase_alumnos.clase_id
      where clase_alumnos.id = hitos_aprendizaje.clase_alumno_id
        and clases.maestra_id = auth.uid()
    )
  );
