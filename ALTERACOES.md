# Registro de Alterações — Sessão de Desenvolvimento

Documento gerado em **04/07/2026** descrevendo todas as mudanças feitas no projeto **Axiom Control** (Angular 19 + Supabase) desde o início desta sessão de trabalho com o assistente.

> **Escopo:** alterações locais ainda não commitadas em relação ao último commit da branch `main` (`2a79b24`), mais arquivos novos não rastreados pelo Git.

---

## Resumo executivo

| Área | O que mudou |
|------|-------------|
| **Dashboard** | Layout shell (header + sidebar fixa + main com scroll), gráfico semanal filtrável, diário de bordo, turnos por operador |
| **Admin** | Cadastro de operador com turno/horário, tabela ampliada, login exclusivo de administrador |
| **Login** | Nova rota `/login` separada para operadores |
| **Autenticação** | `AuthService`, guard de rota, sessões em `sessionStorage` |
| **Supabase** | Turnos por operador, sincronização de turno, policies RLS, `setup-completo.sql` |
| **Frontend global** | Correções de layout (landing, admin, dashboard), fonts unificadas |
| **Utilitários** | `turno.util.ts`, `cpf.util.ts` (validação de CPF removida do fluxo de cadastro) |

---

## Cronologia das solicitações

### 1. Gráfico semanal filtrável no dashboard
- Gráfico com **7 dias da semana selecionada** e **3 barras por tanque** (T1, T2, T3).
- Filtros de **mês** e **semana** integrados ao histórico de `producao_diaria`.
- Título dinâmico da semana exibido no painel.

### 2. Sidebar navegável e tela principal limpa
- Layout em **shell**: header + sidebar + área principal + status bar.
- Navegação por seções com scroll suave e **highlight da seção ativa** (`IntersectionObserver`).
- Conteúdo secundário movido para a sidebar: turno, stats, eventos recentes, relatório PDF, links.

### 3. Correção de layout em todo o frontend
- **Landing (`inicial`)**: CSS escopado em `.landing-page`, grid de features em 2 colunas, animações reveal, padding responsivo.
- **Admin**: variáveis CSS em `:host`, layout responsivo.
- **Dashboard**: overflow corrigido no header/sidebar/statusbar, grids responsivos.
- **`styles.css` / `index.html`**: fonts unificadas (Rajdhani + Space Mono).

### 4. Remoção de operadores mockados do diário de bordo
- Removidos fallbacks fictícios (`operadoresTurnoMock`, `resolverTurnoAtual`, `logOcorrenciasMock`).
- Turno passa a usar **operadores reais** do Supabase e tabela `turnos_fabrica`.
- Funções adicionadas: `identificarPeriodoTurno()`, `PERIODOS_TURNO`, `turnoEstaAtivo()` em `dashboard.mock.ts`.
- `supabase.service.ts`: `sincronizarTurnoAtual()`, `iniciarTurno()`, `finalizarTurno()`, integração com `logs_operacao`.
- SQL: policies de INSERT/UPDATE em `turnos_fabrica`.
- Testes atualizados em `dashboard.mock.spec.ts`.

### 5. Sidebar fixa com scroll apenas no conteúdo
- `.dashboard-page`: `height: 100vh`, `overflow: hidden`.
- Sidebar fixa; `main` com `overflow-y: auto`.
- `navegarPara()` e `IntersectionObserver` usam o elemento `main` como root de scroll.
- Em mobile, sidebar vira **drawer** com overlay.

### 6. Turnos definidos na criação de usuário
- Colunas novas em `operarios`: `turno_nome`, `turno_inicio`, `turno_fim`.
- Formulário admin com presets (Manhã / Tarde / Noite / Personalizado).
- Escala de turnos no dashboard montada **por operador cadastrado**, não mais 3 slots fixos.
- Sincronização de turno usa o **horário do operador logado**.
- Novo utilitário: `src/app/utils/turno.util.ts`.
- Migração SQL para bancos existentes no final de `schema.sql`.

### 7. Remoção da validação/máscara obrigatória de CPF
- Cadastro aceita **qualquer texto** no campo CPF.
- Removidos `validarCpf`, `formatarCpf` e `limparCpf` do fluxo de criação em `admin.component.ts`.
- CPF exibido na tabela exatamente como informado.

### 8. Correção do turno atual e diário de bordo vazios
- **Bug corrigido:** operador fora do horário **finalizava** turnos ativos no banco em vez de só consultar.
- Mensagem explicativa na sidebar quando operador está fora do horário.
- Eventos do sistema passam também para o **diário de bordo** (`logs_operacao`) quando há turno ativo.
- Policy de INSERT em `log_ocorrencias` adicionada ao `schema.sql`.

### 9. Separação de login operador vs administrador
- Nova rota **`/login`** exclusiva para operadores (campo de texto para ID).
- **`/admin`** restrito à senha de administrador.
- Guard `operadorGuard` redireciona para `/login` (antes ia para `/admin`).
- Landing: "Acessar Dashboard" → `/login`; "Acessar Painel Admin" → `/admin`.
- Sessões mutuamente limpas ao trocar de perfil (`clearAdmin` / `clearOperador`).

---

## Arquivos novos

| Arquivo | Descrição |
|---------|-----------|
| `src/app/pages/login/login.component.ts` | Login de operador por ID |
| `src/app/pages/login/login.component.html` | Template do login |
| `src/app/pages/login/login.component.css` | Estilos do login |
| `src/app/services/auth.service.ts` | Sessão operador/admin em `sessionStorage` |
| `src/app/guards/operador.guard.ts` | Protege `/dashboard` |
| `src/app/utils/turno.util.ts` | Presets, formatação e verificação de turno ativo |
| `src/app/utils/cpf.util.ts` | Utilitários de CPF (não usados mais no cadastro) |
| `src/app/utils/cpf.util.spec.ts` | Testes do utilitário de CPF |
| `supabase/setup-completo.sql` | Schema completo + seeds + policies |
| `CONTEXTO.md` | Documentação de contexto do projeto (pré-existente na sessão) |
| `public/.gitkeep` | Placeholder de diretório |

---

## Arquivos modificados (por área)

### Rotas e app
- `src/app/app.routes.ts` — rota `/login`, guard no dashboard
- `src/app/app.routes.server.ts` — SSR client-side para `/login`, `/admin`, `/dashboard`
- `src/app/app.component.ts` — ajustes menores

### Landing (`inicial`)
- `inicial.component.html` — links para `/login` e `/admin`
- `inicial.component.css` — escopo, grid, responsividade

### Admin
- `admin.component.ts` — turno no cadastro, login só admin, `sairAdmin()`, sem validação de CPF
- `admin.component.html` — campos de turno, colunas Turno/Horário, botões de navegação
- `admin.component.css` — responsivo, estilos de turno e login

### Dashboard
- `dashboard.component.ts` — gráfico semanal, shell, turnos por operador, sync de turno, eventos, navegação por seção (~700+ linhas alteradas)
- `dashboard.component.html` — layout shell, sidebar, seções, diário de bordo, gráficos
- `dashboard.component.css` — layout fixo, sidebar drawer, estilos extensivos (~740 linhas)

### Serviços e mocks
- `supabase.service.ts` — CRUD operadores com turno, turnos_fabrica, logs, ocorrências, relatório PDF
- `dashboard.mock.ts` — remoção de mocks de operadores/logs; helpers de período de turno
- `dashboard.mock.spec.ts` — testes atualizados
- `operarios.mock.ts` — interface estendida com campos de turno

### Ambiente e build
- `src/environments/environment.ts` — credenciais Supabase, senha admin, e-mail de relatório
- `src/environments/environment.development.ts` — idem para dev
- `angular.json` — ajustes de build
- `.gitignore` — entradas adicionais
- `src/index.html` — fonts
- `src/styles.css` — estilos globais mínimos

### Supabase
- `supabase/schema.sql` — tabelas, policies, colunas de turno em `operarios`, migração ALTER
- `supabase/functions/send-weekly-pdf/index.ts` — melhorias na Edge Function de PDF

---

## Banco de dados (Supabase)

### Tabela `operarios` — colunas novas
```sql
turno_nome   text  default 'Manhã'
turno_inicio text  default '06:00'
turno_fim    text  default '14:00'
```

### Tabelas utilizadas pelo dashboard
| Tabela | Uso |
|--------|-----|
| `operarios` | Cadastro e login por ID |
| `turnos_fabrica` | Turno ativo da fábrica |
| `logs_operacao` | Diário de bordo (por `turno_id`) |
| `log_ocorrencias` | Eventos recentes (sidebar) |
| `producao_diaria` | KPIs e gráficos |
| `status_tanques` | Cards de tanques |
| `ocorrencias_operador` | Formulário de ocorrências |

### Seeds em `setup-completo.sql`
- Operadores: `AX101`, `BR202`, `CN303`, `DE404` (com turnos distintos)
- Tanques, produção diária (abr–jun/2026), logs, turno ativo de exemplo

### SQL manual para bancos já existentes
```sql
-- Colunas de turno
alter table operarios add column if not exists turno_nome text not null default 'Manhã';
alter table operarios add column if not exists turno_inicio text not null default '06:00';
alter table operarios add column if not exists turno_fim text not null default '14:00';

-- Policies que podem faltar
create policy "Escrita anonima turnos_fabrica" on turnos_fabrica for insert to anon with check (true);
create policy "Atualizacao anonima turnos_fabrica" on turnos_fabrica for update to anon using (true);
create policy "Escrita anonima log_ocorrencias" on log_ocorrencias for insert to anon with check (true);
create policy "Escrita anonima logs_operacao" on logs_operacao for insert to anon with check (true);
```

---

## Autenticação e fluxo de acesso

| Rota | Quem acessa | Credencial |
|------|-------------|------------|
| `/` | Todos | — |
| `/login` | Operador | ID gerado no cadastro (ex.: `AX101`, `CN303`) |
| `/admin` | Administrador | Senha padrão: `admin123` |
| `/dashboard` | Operador ou admin logado | Guard `operadorGuard` |

### Comportamento do turno
- Turno só é **iniciado automaticamente** se o operador logado estiver **dentro do horário cadastrado**.
- Fora do horário: exibe turno da fábrica em andamento (se existir) ou mensagem explicativa.
- **Diário de bordo** depende de um turno com `id` válido em `turnos_fabrica`.
- **Eventos recentes** vêm de `log_ocorrencias` (seeds + simulação de produção + ações do operador).

---

## Diferença entre logs do sistema

| UI | Tabela | Conteúdo |
|----|--------|----------|
| **Eventos recentes** (sidebar) | `log_ocorrencias` | Eventos gerais, simulação de dias, ocorrências |
| **Diário de bordo** | `logs_operacao` | Registros ligados ao turno ativo (`turno_id`) |

Os eventos da simulação (avanço de dia a cada 10 s) refletem dados de `producao_diaria`, **não são leituras de sensores em tempo real**.

---

## Estatísticas Git (referência)

```
23 arquivos modificados
~2.441 inserções, ~761 remoções
+ arquivos novos não rastreados listados acima
```

---

## Observações técnicas

1. **Budget CSS do dashboard** (~19,98 kB / 20 kB) — no limite do `angular.json`; novos estilos podem exigir aumento do budget.
2. **`npm test`** — falha por ausência de `tsconfig.spec.json` (pré-existente no projeto).
3. **`package-lock.json`** — pode ter sido alterado em momentos anteriores da sessão; verificar `git status` antes de commitar.
4. Operador **Noite** (`CN303`, 22:00–06:00) é o adequado para testes noturnos; Manhã/Tarde ficam fora do horário à noite.

---

## Como testar rapidamente

1. Rodar `npm install` e `npm run build` (ou `ng serve`).
2. Executar `supabase/setup-completo.sql` no SQL Editor (banco novo) **ou** as migrações acima (banco existente).
3. Admin em `/admin` → senha `admin123` → criar operador com turno.
4. Operador em `/login` → informar ID → dashboard.
5. Verificar sidebar (turno, eventos) e seção **Diário de Bordo**.

---

*Este arquivo documenta o trabalho da sessão de pair programming com IA. Para contexto arquitetural mais amplo, consulte também `CONTEXTO.md`.*
