-- ============================================================
-- Migración 003: Relación Muchos a Muchos Clases <-> Temas
-- ============================================================

-- Tabla intermedia para permitir múltiples temas por clase
create table if not exists public.clases_temas (
  id        uuid primary key default uuid_generate_v4(),
  clase_id  uuid not null references public.clases(id) on delete cascade,
  tema_id   uuid not null references public.temas(id) on delete cascade,
  created_at timestamptz default now(),
  unique (clase_id, tema_id)
);

-- Habilitar RLS
alter table public.clases_temas enable row level security;

-- Políticas de seguridad (las mismas que clases y temas)
create policy "clases_temas_own_maestra" on public.clases_temas
  for all using (
    exists (
      select 1 from public.clases
      where id = public.clases_temas.clase_id
      and maestra_id = auth.uid()
    )
  );

-- Indexar para búsquedas rápidas
create index if not exists idx_clases_temas_clase on public.clases_temas(clase_id);
create index if not exists idx_clases_temas_tema on public.clases_temas(tema_id);
