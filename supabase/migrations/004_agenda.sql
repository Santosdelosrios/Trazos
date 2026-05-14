-- 1. Tabla de Agenda para planificación de clases futuras
create table if not exists public.agenda (
  id          uuid primary key default uuid_generate_v4(),
  maestra_id  uuid not null references auth.users(id) on delete cascade,
  alumno_id   uuid not null references public.alumnos(id) on delete cascade,
  fecha       date not null,
  hora        time not null,
  tema_previsto text,
  materia     text not null,
  estado      text not null default 'pendiente', -- 'pendiente', 'completada', 'cancelada'
  created_at  timestamptz default now()
);

-- 2. Habilitar RLS
alter table public.agenda enable row level security;

-- 3. Políticas de acceso
create policy "agenda_own_maestra" on public.agenda
  for all using (maestra_id = auth.uid());

-- 4. Índices para performance
create index if not exists idx_agenda_maestra_fecha on public.agenda(maestra_id, fecha);
create index if not exists idx_agenda_alumno on public.agenda(alumno_id);
