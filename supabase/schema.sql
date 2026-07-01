-- Schema sugerido para o dashboard Axiom Control (Supabase SQL Editor)

create table if not exists status_tanques (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  linha text not null,
  nome text not null,
  temperatura numeric not null default 0,
  nivel numeric not null default 0,
  status text not null default 'normal',
  status_texto text not null default 'OPERANDO — NORMAL',
  updated_at timestamptz not null default now()
);

create table if not exists historico_temperatura (
  id bigint generated always as identity primary key,
  tanque_codigo text not null references status_tanques (codigo) on delete cascade,
  temperatura numeric not null,
  perigo boolean not null default false,
  registrado_em timestamptz not null default now()
);

create table if not exists log_ocorrencias (
  id bigint generated always as identity primary key,
  horario timestamptz not null default now(),
  mensagem text not null,
  tipo text not null default 'info'
);

create table if not exists projecoes_ia (
  id bigint generated always as identity primary key,
  horario text not null,
  mensagem text not null,
  tipo text not null default 'predicao'
);

create table if not exists ocorrencias_operador (
  id bigint generated always as identity primary key,
  descricao text not null,
  tanques text[] not null default '{}',
  created_at timestamptz not null default now()
);

insert into status_tanques (codigo, linha, nome, temperatura, nivel, status, status_texto)
values
  ('TK-001', 'LINHA A', 'Tanque 01 — Misturador', 85, 70, 'normal', 'OPERANDO — NORMAL'),
  ('TK-002', 'LINHA B', 'Tanque 02 — Reator Químico', 115, 40, 'critico', 'CRÍTICO — SUPERAQUECIMENTO'),
  ('TK-003', 'LINHA C', 'Tanque 03 — Armazenamento', 22, 5, 'manutencao', 'EM MANUTENÇÃO')
on conflict (codigo) do update set
  temperatura = excluded.temperatura,
  nivel = excluded.nivel,
  status = excluded.status,
  status_texto = excluded.status_texto,
  updated_at = now();
