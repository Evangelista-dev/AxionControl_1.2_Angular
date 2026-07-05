-- Schema completo para o dashboard Axiom Control (Supabase SQL Editor)

create table if not exists operarios (
  id bigint generated always as identity primary key,
  id_gerado text not null unique,
  nome text not null,
  cpf text not null,
  turno_nome text not null default 'Manhã',
  turno_inicio text not null default '06:00',
  turno_fim text not null default '14:00',
  created_at timestamptz not null default now()
);

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

create table if not exists producao_diaria (
  id bigint generated always as identity primary key,
  data_registro date not null unique,
  temperatura_t1 numeric,
  temperatura_t2 numeric,
  temperatura_t3 numeric,
  temperatura numeric,
  nivel numeric,
  alertas integer not null default 0,
  created_at timestamptz not null default now()
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

create table if not exists turnos_fabrica (
  id bigint generated always as identity primary key,
  operario_nome text not null,
  turno text not null,
  horario text not null,
  status text not null default 'em_andamento',
  created_at timestamptz not null default now()
);

create table if not exists logs_operacao (
  id bigint generated always as identity primary key,
  turno_id bigint references turnos_fabrica (id) on delete cascade,
  mensagem text not null,
  tipo text not null default 'info',
  created_at timestamptz not null default now()
);

alter table operarios enable row level security;
alter table status_tanques enable row level security;
alter table historico_temperatura enable row level security;
alter table producao_diaria enable row level security;
alter table log_ocorrencias enable row level security;
alter table projecoes_ia enable row level security;
alter table ocorrencias_operador enable row level security;
alter table turnos_fabrica enable row level security;
alter table logs_operacao enable row level security;

create policy "Leitura anonima operarios" on operarios for select to anon using (true);
create policy "Escrita anonima operarios" on operarios for insert to anon with check (true);
create policy "Atualizacao anonima operarios" on operarios for update to anon using (true);
create policy "Remocao anonima operarios" on operarios for delete to anon using (true);

create policy "Leitura anonima status_tanques" on status_tanques for select to anon using (true);
create policy "Leitura anonima historico_temperatura" on historico_temperatura for select to anon using (true);
create policy "Leitura anonima producao_diaria" on producao_diaria for select to anon using (true);
create policy "Leitura anonima log_ocorrencias" on log_ocorrencias for select to anon using (true);
create policy "Escrita anonima log_ocorrencias" on log_ocorrencias for insert to anon with check (true);
create policy "Leitura anonima projecoes_ia" on projecoes_ia for select to anon using (true);
create policy "Escrita anonima ocorrencias_operador" on ocorrencias_operador for insert to anon with check (true);
create policy "Leitura anonima turnos_fabrica" on turnos_fabrica for select to anon using (true);
create policy "Escrita anonima turnos_fabrica" on turnos_fabrica for insert to anon with check (true);
create policy "Atualizacao anonima turnos_fabrica" on turnos_fabrica for update to anon using (true);
create policy "Leitura anonima logs_operacao" on logs_operacao for select to anon using (true);
create policy "Escrita anonima logs_operacao" on logs_operacao for insert to anon with check (true);

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

insert into projecoes_ia (horario, mensagem, tipo)
select * from (values
  ('[Em 15 min]', '[OTIMIZAÇÃO] Redução de 12% no consumo de energia prevista.', 'predicao'),
  ('[Crítico]', '[SEGURANÇA] Tendência de superaquecimento projetada em 18 minutos.', 'alerta-critico')
) as seed(horario, mensagem, tipo)
where not exists (select 1 from projecoes_ia limit 1);

-- Migração: turnos por operador (bancos já existentes)
alter table operarios add column if not exists turno_nome text not null default 'Manhã';
alter table operarios add column if not exists turno_inicio text not null default '06:00';
alter table operarios add column if not exists turno_fim text not null default '14:00';
