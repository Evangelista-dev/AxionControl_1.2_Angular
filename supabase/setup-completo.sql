-- =============================================================================
-- AXIOM CONTROL — Setup completo do Supabase
-- =============================================================================
-- Como usar:
--   1. Abra o Supabase Dashboard → SQL Editor → New query
--   2. Cole este arquivo inteiro e clique em RUN
--   3. Confira no Table Editor se as tabelas e dados foram criados
--
-- O script é idempotente: pode rodar mais de uma vez (drop + recreate policies).
-- ATENÇÃO: a seção de limpeza APAGA todos os dados das tabelas do app.
-- =============================================================================

-- =============================================================================
-- 1. LIMPEZA (reset total — DROP TABLE CASCADE remove policies automaticamente)
--    Não use DROP POLICY aqui: falha se a tabela ainda não existir (42P01).
-- =============================================================================

drop table if exists logs_operacao cascade;
drop table if exists historico_temperatura cascade;
drop table if exists turnos_fabrica cascade;
drop table if exists operarios cascade;
drop table if exists producao_diaria cascade;
drop table if exists log_ocorrencias cascade;
drop table if exists projecoes_ia cascade;
drop table if exists ocorrencias_operador cascade;
drop table if exists status_tanques cascade;

-- =============================================================================
-- 2. TABELAS
-- =============================================================================

create table operarios (
  id bigint generated always as identity primary key,
  id_gerado text not null unique,
  nome text not null,
  cpf text not null,
  turno_nome text not null default 'Manhã',
  turno_inicio text not null default '06:00',
  turno_fim text not null default '14:00',
  created_at timestamptz not null default now()
);

create table status_tanques (
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

create table historico_temperatura (
  id bigint generated always as identity primary key,
  tanque_codigo text not null references status_tanques (codigo) on delete cascade,
  temperatura numeric not null,
  perigo boolean not null default false,
  registrado_em timestamptz not null default now()
);

create table producao_diaria (
  id bigint generated always as identity primary key,
  data_registro date not null unique,
  temperatura_t1 numeric not null default 0,
  temperatura_t2 numeric not null default 0,
  temperatura_t3 numeric not null default 0,
  temperatura numeric not null default 0,
  nivel numeric not null default 0,
  alertas integer not null default 0,
  created_at timestamptz not null default now()
);

create table log_ocorrencias (
  id bigint generated always as identity primary key,
  horario timestamptz not null default now(),
  mensagem text not null,
  tipo text not null default 'info'
);

create table projecoes_ia (
  id bigint generated always as identity primary key,
  horario text not null,
  mensagem text not null,
  tipo text not null default 'predicao'
);

create table ocorrencias_operador (
  id bigint generated always as identity primary key,
  descricao text not null,
  tanques text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table turnos_fabrica (
  id bigint generated always as identity primary key,
  operario_nome text not null,
  turno text not null,
  horario text not null,
  status text not null default 'em_andamento',
  created_at timestamptz not null default now()
);

create table logs_operacao (
  id bigint generated always as identity primary key,
  turno_id bigint references turnos_fabrica (id) on delete cascade,
  mensagem text not null,
  tipo text not null default 'info',
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 3. ROW LEVEL SECURITY (role anon — adequado para MVP)
-- =============================================================================

alter table operarios enable row level security;
alter table status_tanques enable row level security;
alter table historico_temperatura enable row level security;
alter table producao_diaria enable row level security;
alter table log_ocorrencias enable row level security;
alter table projecoes_ia enable row level security;
alter table ocorrencias_operador enable row level security;
alter table turnos_fabrica enable row level security;
alter table logs_operacao enable row level security;

-- operarios (CRUD — painel admin)
create policy "Leitura anonima operarios" on operarios for select to anon using (true);
create policy "Escrita anonima operarios" on operarios for insert to anon with check (true);
create policy "Atualizacao anonima operarios" on operarios for update to anon using (true);
create policy "Remocao anonima operarios" on operarios for delete to anon using (true);

-- leitura industrial
create policy "Leitura anonima status_tanques" on status_tanques for select to anon using (true);
create policy "Leitura anonima historico_temperatura" on historico_temperatura for select to anon using (true);
create policy "Leitura anonima producao_diaria" on producao_diaria for select to anon using (true);
create policy "Leitura anonima log_ocorrencias" on log_ocorrencias for select to anon using (true);
create policy "Escrita anonima log_ocorrencias" on log_ocorrencias for insert to anon with check (true);
create policy "Leitura anonima projecoes_ia" on projecoes_ia for select to anon using (true);
create policy "Leitura anonima turnos_fabrica" on turnos_fabrica for select to anon using (true);
create policy "Escrita anonima turnos_fabrica" on turnos_fabrica for insert to anon with check (true);
create policy "Atualizacao anonima turnos_fabrica" on turnos_fabrica for update to anon using (true);
create policy "Leitura anonima logs_operacao" on logs_operacao for select to anon using (true);

-- escrita operacional
create policy "Escrita anonima ocorrencias_operador" on ocorrencias_operador for insert to anon with check (true);
create policy "Leitura anonima ocorrencias_operador" on ocorrencias_operador for select to anon using (true);
create policy "Escrita anonima logs_operacao" on logs_operacao for insert to anon with check (true);

-- =============================================================================
-- 4. SEEDS — Operadores (login no /admin com o ID)
-- =============================================================================

insert into operarios (id_gerado, nome, cpf, turno_nome, turno_inicio, turno_fim, created_at) values
  ('AX101', 'Ana Paula Silva', '529.982.247-25', 'Manhã', '06:00', '14:00', '2026-04-01 08:30:00+00'),
  ('BR202', 'Carlos Mendes', '390.533.447-05', 'Tarde', '14:00', '22:00', '2026-04-02 09:15:00+00'),
  ('CN303', 'Juliana Rocha', '153.509.460-56', 'Noite', '22:00', '06:00', '2026-04-03 10:45:00+00'),
  ('DE404', 'Rafael Torres', '231.002.999-00', 'Manhã', '06:00', '14:00', '2026-04-04 11:20:00+00');

-- =============================================================================
-- 5. SEEDS — Status dos tanques
-- =============================================================================

insert into status_tanques (codigo, linha, nome, temperatura, nivel, status, status_texto) values
  ('TK-001', 'LINHA A', 'Tanque 01 — Misturador', 85, 70, 'normal', 'OPERANDO — NORMAL'),
  ('TK-002', 'LINHA B', 'Tanque 02 — Reator Químico', 115, 40, 'critico', 'CRÍTICO — SUPERAQUECIMENTO'),
  ('TK-003', 'LINHA C', 'Tanque 03 — Armazenamento', 22, 5, 'manutencao', 'EM MANUTENÇÃO');

-- =============================================================================
-- 6. SEEDS — Produção diária (Abril, Maio e Junho/2026)
--    Alimenta KPIs, gráficos mensais e relatório PDF
-- =============================================================================

insert into producao_diaria (
  data_registro,
  temperatura_t1,
  temperatura_t2,
  temperatura_t3,
  temperatura,
  nivel,
  alertas
)
select
  d.data_registro,
  round(42 + (d.idx::numeric / 91) * 18 + (d.dia % 5))::numeric as temperatura_t1,
  round(55 + (d.idx::numeric / 91) * 25 + (d.dia % 7))::numeric as temperatura_t2,
  round(20 + (d.idx::numeric / 91) * 8 + (d.dia % 3))::numeric as temperatura_t3,
  round(
    (
      round(42 + (d.idx::numeric / 91) * 18 + (d.dia % 5)) +
      round(55 + (d.idx::numeric / 91) * 25 + (d.dia % 7)) +
      round(20 + (d.idx::numeric / 91) * 8 + (d.dia % 3))
    ) / 3.0,
    1
  )::numeric as temperatura,
  greatest(5, least(95, round(70 - (d.idx::numeric / 91) * 15 + (d.dia % 10))))::numeric as nivel,
  case
    when round(55 + (d.idx::numeric / 91) * 25 + (d.dia % 7)) >= 85
      or round(42 + (d.idx::numeric / 91) * 18 + (d.dia % 5)) >= 90
      then 1 + (d.dia % 3)
    when d.dia % 11 = 0 then 1
    else 0
  end as alertas
from (
  select
    gs::date as data_registro,
    row_number() over (order by gs) - 1 as idx,
    extract(day from gs)::int as dia
  from generate_series('2026-04-01'::date, '2026-06-30'::date, interval '1 day') as gs
) as d;

-- =============================================================================
-- 7. SEEDS — Histórico de temperatura (amostra por tanque)
-- =============================================================================

insert into historico_temperatura (tanque_codigo, temperatura, perigo, registrado_em) values
  ('TK-001', 25, false, '2026-06-28 10:00:00+00'),
  ('TK-001', 45, false, '2026-06-28 11:00:00+00'),
  ('TK-001', 46, false, '2026-06-28 12:00:00+00'),
  ('TK-001', 44, false, '2026-06-28 13:00:00+00'),
  ('TK-001', 45, false, '2026-06-28 14:00:00+00'),
  ('TK-002', 40, false, '2026-06-28 10:00:00+00'),
  ('TK-002', 60, false, '2026-06-28 11:00:00+00'),
  ('TK-002', 85, true,  '2026-06-28 12:00:00+00'),
  ('TK-002', 95, true,  '2026-06-28 13:00:00+00'),
  ('TK-002', 98, true,  '2026-06-28 14:00:00+00'),
  ('TK-003', 60, false, '2026-06-28 10:00:00+00'),
  ('TK-003', 40, false, '2026-06-28 11:00:00+00'),
  ('TK-003', 25, false, '2026-06-28 12:00:00+00'),
  ('TK-003', 22, false, '2026-06-28 13:00:00+00'),
  ('TK-003', 22, false, '2026-06-28 14:00:00+00');

-- =============================================================================
-- 8. SEEDS — Log de ocorrências do sistema
-- =============================================================================

insert into log_ocorrencias (horario, mensagem, tipo) values
  ('2026-06-28 08:00:12+00', '[SISTEMA] Login do Operador: Ana Paula Silva (Turno A).', 'info'),
  ('2026-06-28 09:15:00+00', '[TANQUE 03] Ciclo de lavagem concluído com sucesso.', 'sucesso'),
  ('2026-06-28 09:20:33+00', '[TANQUE 03] Válvulas bloqueadas fisicamente para manutenção.', 'info'),
  ('2026-06-28 10:05:10+00', '[TANQUE 01] Iniciando ciclo de mistura nominal.', 'info'),
  ('2026-06-28 11:00:05+00', '[TANQUE 01] Temperatura ideal (45°C) atingida e estabilizada.', 'sucesso'),
  ('2026-06-28 13:45:22+00', '[TANQUE 02] Aviso: Taxa de aquecimento acima do padrão.', 'alerta'),
  ('2026-06-28 14:10:00+00', '[TANQUE 02] CRÍTICO: Temperatura em 98°C. Limite de segurança excedido!', 'erro');

-- =============================================================================
-- 9. SEEDS — Turno ativo + diário de bordo
-- =============================================================================

insert into turnos_fabrica (operario_nome, turno, horario, status) values
  ('Ana Paula Silva', 'Manhã', '06:00 às 14:00', 'em_andamento');

insert into logs_operacao (turno_id, mensagem, tipo, created_at)
select
  tf.id,
  seed.mensagem,
  seed.tipo,
  seed.created_at
from turnos_fabrica tf
cross join (
  values
    ('[SISTEMA] Turno iniciado. Operadora Ana Paula Silva em serviço.', 'info', '2026-06-28 06:00:00+00'::timestamptz),
    ('[TANQUE 01] Verificação de válvulas concluída.', 'sucesso', '2026-06-28 06:30:00+00'::timestamptz),
    ('[TANQUE 02] Aquecimento acelerado detectado.', 'alerta', '2026-06-28 09:45:00+00'::timestamptz),
    ('[LINHA B] Operador solicitou revisão de pressão.', 'info', '2026-06-28 11:20:00+00'::timestamptz)
) as seed(mensagem, tipo, created_at)
where tf.status = 'em_andamento'
limit 4;

-- =============================================================================
-- 10. SEEDS — Ocorrências de exemplo (aparecem no PDF semanal)
-- =============================================================================

insert into ocorrencias_operador (descricao, tanques, created_at) values
  (
    'Vazamento leve detectado na válvula de saída do Tanque 02 durante inspeção de rotina.',
    array['Tanque 02'],
    '2026-06-27 15:30:00+00'
  ),
  (
    'Oscilação de temperatura no Tanque 01 corrigida após ajuste manual do setpoint.',
    array['Tanque 01'],
    '2026-06-26 10:15:00+00'
  );

-- =============================================================================
-- 11. VERIFICAÇÃO (opcional — confira os totais após o RUN)
-- =============================================================================

select 'operarios' as tabela, count(*) as total from operarios
union all select 'status_tanques', count(*) from status_tanques
union all select 'producao_diaria', count(*) from producao_diaria
union all select 'historico_temperatura', count(*) from historico_temperatura
union all select 'log_ocorrencias', count(*) from log_ocorrencias
union all select 'turnos_fabrica', count(*) from turnos_fabrica
union all select 'logs_operacao', count(*) from logs_operacao
union all select 'ocorrencias_operador', count(*) from ocorrencias_operador
order by tabela;

-- Resultado esperado:
-- operarios             → 4
-- status_tanques        → 3
-- producao_diaria       → 91  (abr + mai + jun/2026)
-- historico_temperatura → 15
-- log_ocorrencias       → 7
-- turnos_fabrica        → 1
-- logs_operacao         → 4
-- ocorrencias_operador  → 2

-- =============================================================================
-- CREDENCIAIS PARA TESTAR O APP
-- =============================================================================
-- Operador (dashboard):  AX101 | BR202 | CN303 | DE404
-- Admin (painel):        admin123  (definido no environment.ts do Angular)
-- Edge Function PDF:     deploy send-weekly-pdf + RESEND_API_KEY no Supabase
-- =============================================================================
