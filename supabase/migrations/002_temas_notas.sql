-- ============================================================
-- Migración 002: 3 ejercicios, notas, tracking de temas
-- ============================================================

-- Tabla de temas para tracking de evolución
create table if not exists public.temas (
  id          uuid primary key default uuid_generate_v4(),
  maestra_id  uuid not null references public.maestras(id) on delete cascade,
  nombre      text not null,
  materia     materia_enum not null,
  created_at  timestamptz default now(),
  unique (maestra_id, nombre, materia)
);

create index if not exists idx_temas_maestra on public.temas(maestra_id);

alter table public.temas enable row level security;

create policy "temas_own_maestra" on public.temas
  for all using (maestra_id = auth.uid());

-- Agregar columna tema_id a clases
alter table public.clases add column if not exists tema_id uuid references public.temas(id);

-- Agregar columnas a clase_alumnos para 3 ejercicios y nota
alter table public.clase_alumnos 
  add column if not exists ejercicios_resultados jsonb default '[]'::jsonb,
  add column if not exists nota numeric(3,1),
  add column if not exists total_correctas smallint default 0;
