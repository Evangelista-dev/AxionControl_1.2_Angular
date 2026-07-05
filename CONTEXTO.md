# Axiom Control — Contexto do Sistema

> Documento de referência do projeto **AxionControl 1.1 Angular**.  
> Última atualização: julho/2026.

---

## 1. Visão geral

**Axiom Control** é um sistema web de **monitoramento industrial** para controle de **tanques químicos/industriais**. O foco é operação em tempo (quase) real: temperatura, nível, status operacional, alertas, turnos de operadores, IA preditiva (simulada) e parada de emergência (E-Stop).

| Item | Valor |
|------|-------|
| Nome do produto | Axiom Control |
| Nome do pacote npm | `axion-control-1.1-angular` |
| Versão Angular | 19.2.x |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Estado do projeto | MVP / protótipo funcional |

### Tanques monitorados (3 unidades)

| Código | Linha | Nome | Estados possíveis |
|--------|-------|------|-------------------|
| TK-001 | LINHA A | Tanque 01 — Misturador | normal |
| TK-002 | LINHA B | Tanque 02 — Reator Químico | normal, critico |
| TK-003 | LINHA C | Tanque 03 — Armazenamento | normal, critico, manutencao |

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | Angular 19 (standalone components, control flow `@if` / `@for`) |
| Roteamento | Angular Router |
| Forms | Template-driven (`FormsModule`, `ngModel`) |
| SSR | Angular SSR + Express (`src/server.ts`) |
| BaaS | Supabase (`@supabase/supabase-js` v2) |
| E-mail / PDF | Edge Function Deno + pdf-lib + Resend API |
| Testes | Karma + Jasmine (cobertura mínima) |
| Linguagem | TypeScript 5.7 |

### Scripts npm

```bash
npm start          # ng serve → http://localhost:4200
npm run build      # build produção + SSR
npm test           # testes unitários
npm run serve:ssr:AxionControl_1.1_Angular  # servidor SSR após build
```

---

## 3. Estrutura de diretórios

```
AxionControl_1.1_Angular/
├── public/                          # Assets estáticos (referenciado no angular.json)
├── src/
│   ├── app/
│   │   ├── pages/
│   │   │   ├── inicial/             # Landing page (dados simulados)
│   │   │   ├── admin/               # Login + CRUD de operadores
│   │   │   └── dashboard/           # Painel operacional principal
│   │   ├── services/
│   │   │   ├── supabase.service.ts  # Camada de dados (Supabase + mocks)
│   │   │   └── auth.service.ts      # Sessão em sessionStorage
│   │   ├── guards/
│   │   │   └── operador.guard.ts    # Protege /dashboard
│   │   ├── mocks/
│   │   │   ├── dashboard.mock.ts    # Dados e helpers do dashboard
│   │   │   └── operarios.mock.ts    # Operadores de fallback
│   │   ├── utils/
│   │   │   └── cpf.util.ts          # Validação/formatação de CPF
│   │   ├── app.routes.ts
│   │   ├── app.config.ts
│   │   └── app.component.ts
│   ├── environments/
│   │   ├── environment.ts           # Produção
│   │   └── environment.development.ts
│   ├── main.ts
│   ├── main.server.ts
│   └── server.ts                    # Express SSR
├── supabase/
│   ├── schema.sql                   # DDL completo + RLS + seeds
│   └── functions/
│       └── send-weekly-pdf/         # Relatório semanal por e-mail
├── angular.json
├── package.json
└── CONTEXTO.md                      # Este arquivo
```

---

## 4. Rotas e páginas

| Rota | Componente | Acesso | Descrição |
|------|------------|--------|-----------|
| `/` | `InicialComponent` | Público | Landing com preview animado (dados locais simulados) |
| `/admin` | `AdminComponent` | Público (login interno) | Login unificado + painel admin |
| `/dashboard` | `DashboardComponent` | Protegido (`operadorGuard`) | Painel industrial completo |

### Fluxo de navegação

```
Landing (/)
    │
    ├─► /admin?destino=dashboard  ──► Login operador ──► /dashboard
    │
    └─► /admin ──► Senha admin ──► Painel CRUD ──► "Abrir Dashboard" ──► /dashboard
```

---

## 5. Autenticação e autorização

> **Importante:** não usa Supabase Auth. A autenticação é **client-side** via `sessionStorage`.

### AuthService (`src/app/services/auth.service.ts`)

| Chave sessionStorage | Conteúdo | Uso |
|---------------------|----------|-----|
| `axiom_operador` | `{ id_gerado, nome }` | Sessão de operador |
| `axiom_admin` | `"true"` | Sessão de administrador |

### Login em `/admin`

| Credencial | Comportamento |
|------------|---------------|
| **ID de operador** (ex.: `AX101`) | Valida no Supabase → grava sessão operador → redireciona `/dashboard` |
| **Senha admin** (`environment.adminPassword`, padrão `admin123`) | Abre painel de gestão de usuários |

### Guard (`operadorGuard`)

- Permite `/dashboard` se **operador logado** OU **admin logado**
- Caso contrário, redireciona para `/admin?destino=dashboard` com mensagem orientativa

### Códigos sensíveis (environment)

```typescript
// src/environments/environment.ts
adminPassword: 'admin123'      // Login administrador
eStopCode: 'senhabraba'         // Parada de emergência no dashboard
reportEmail: '...'              // Destino do relatório semanal
dashboardRefreshMs: 30000       // Polling do dashboard (30s)
```

> **Limitação de segurança:** credenciais ficam no bundle frontend. Adequado para MVP; produção exige Supabase Auth ou backend dedicado.

---

## 6. Páginas — detalhamento

### 6.1 Landing (`InicialComponent`)

- **Dados 100% locais/simulados** — não conecta ao Supabase
- Animações de temperatura e logs em `setInterval`
- Botão "Acessar Dashboard" → `/admin?destino=dashboard`
- Exibe 3 tanques (contador 3/3)

### 6.2 Admin (`AdminComponent`)

**Funcionalidades:**
- CRUD de operadores (nome, CPF, ID auto-gerado)
- Validação de CPF (`cpf.util.ts`)
- Busca/filtro na tabela
- Reset de todos os operadores (zona de perigo)
- Link "Abrir Dashboard" no header (requer sessão admin)

**Campos do operador no banco:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id_gerado` | text (unique) | ID de login (6 chars, uppercase) |
| `nome` | text | Nome completo |
| `cpf` | text | CPF formatado |
| `created_at` | timestamptz | Data de cadastro |

### 6.3 Dashboard (`DashboardComponent`)

**Seções do painel:**
1. **Status dos tanques** — cards com temp, nível, status, barra visual, botão E-Stop
2. **Projeções de IA** — lista preditiva (Supabase ou mock)
3. **Gráficos térmicos** — média semanal dos 3 tanques (`producao_diaria`)
4. **Log de ocorrências** — eventos/alarmes gerais
5. **Turnos e diário de bordo** — operador atual, escala, logs do turno
6. **Relatar ocorrência** — formulário → tabela `ocorrencias_operador`
7. **Relatório semanal** — invoca Edge Function `send-weekly-pdf`

**Comportamento em tempo real:**
- Refresh automático a cada 30s (`dashboardRefreshMs`)
- Indicador "Último sync" atualizado a cada 1s
- Uptime calculado desde o início da sessão no browser

**Turnos (lógica local quando `turnos_fabrica` vazio):**

| Turno | Horário |
|-------|---------|
| Manhã | 06:00 – 14:00 |
| Tarde | 14:00 – 22:00 |
| Noite | 22:00 – 06:00 |

Operadores do Supabase são distribuídos na escala por ordem de cadastro (índice 0, 1, 2). Fallback: mocks em `dashboard.mock.ts` (`resolverTurnoAtual`).

---

## 7. Camada de dados — SupabaseService

Arquivo central: `src/app/services/supabase.service.ts`

### Estratégia de fallback

```
Browser + Supabase OK  →  useMockData = false  →  consulta tabelas reais
SSR / erro / sem window →  useMockData = true   →  dados em memória (mocks)
Tabela vazia / erro     →  fallback para mocks específicos por método
```

### Métodos públicos

| Método | Tabela(s) | Descrição |
|--------|-----------|-----------|
| `listarOperarios()` | operarios | Lista todos |
| `cadastrarOperario()` | operarios | Insert |
| `deletarOperario()` | operarios | Delete por id_gerado |
| `limparTodosOperarios()` | operarios | Delete all |
| `verificarId()` | operarios | Login operador (case-insensitive) |
| `obterStatusTanques()` | status_tanques | Status atual; fallback: producao_diaria ou mock |
| `obterHistoricoTemperatura()` | historico_temperatura | Por tanque |
| `obterHistoricoProducao()` | producao_diaria | Série temporal |
| `obterMediaSemanalTanques()` | producao_diaria | Últimos 7 dias, média T1/T2/T3 |
| `obterLogOcorrencias()` | log_ocorrencias | Eventos gerais |
| `obterProjecoesIa()` | projecoes_ia | Predições IA |
| `obterTurnoAtual()` | turnos_fabrica | Turno em andamento |
| `obterLogsDoTurno()` | logs_operacao | Logs por turno_id |
| `adicionarLog()` | logs_operacao | Insert log de turno |
| `obterOperariosParaTurnos()` | operarios | Escala de turnos |
| `enviarOcorrencia()` | ocorrencias_operador | Notificação operador |
| `enviarRelatorioEmail()` | Edge Function | PDF semanal por e-mail |

### Mocks de referência

**Operadores mock** (`operarios.mock.ts`):

| ID | Nome |
|----|------|
| AX101 | Ana Paula Silva |
| BR202 | Carlos Mendes |
| CN303 | Juliana Rocha |
| DE404 | Rafael Torres |

> Mocks só funcionam quando `useMockData = true` (SSR ou falha de conexão). Com Supabase conectado, apenas IDs reais no banco funcionam.

---

## 8. Banco de dados (Supabase)

Schema completo: `supabase/schema.sql`

### Tabelas

| Tabela | Finalidade |
|--------|------------|
| `operarios` | Cadastro de operadores |
| `status_tanques` | Estado atual dos 3 tanques |
| `historico_temperatura` | Série temporal por tanque |
| `producao_diaria` | Agregado diário (gráficos, PDF) |
| `log_ocorrencias` | Log geral de eventos |
| `projecoes_ia` | Mensagens de IA preditiva |
| `ocorrencias_operador` | Relatos enviados pelo dashboard |
| `turnos_fabrica` | Turnos ativos/histórico |
| `logs_operacao` | Diário de bordo por turno |

### RLS (Row Level Security)

Todas as tabelas têm RLS habilitado com políticas **permissivas para role `anon`** (leitura/escrita conforme necessidade). Adequado para MVP; **restringir antes de produção pública**.

### Setup / reset do banco

1. Supabase Dashboard → SQL Editor
2. (Opcional) Dropar tabelas existentes do app
3. Executar `supabase/schema.sql`
4. Verificar seeds: 3 tanques + 2 projeções IA

Após reset, **`operarios` fica vazio** — criar operadores via `/admin` antes de testar login no dashboard.

---

## 9. Edge Function — Relatório semanal

**Caminho:** `supabase/functions/send-weekly-pdf/index.ts`

| Item | Detalhe |
|------|---------|
| Trigger | Botão no dashboard → `supabase.functions.invoke('send-weekly-pdf')` |
| Payload | `{ email, dados }` — `dados` = registros de `producao_diaria` |
| PDF | Gerado com pdf-lib (Deno) |
| E-mail | Enviado via Resend API |
| Variáveis de ambiente | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (opcional) |
| Destino | `payload.email` ou fallback fixo no código |

---

## 10. Configuração de ambientes

| Arquivo | `production` | Uso |
|---------|--------------|-----|
| `environment.ts` | `true` | Build produção |
| `environment.development.ts` | `false` | `ng serve` (file replacement) |

Ambos apontam para o mesmo projeto Supabase. Credenciais sensíveis estão centralizadas no environment (não hardcoded nos componentes).

---

## 11. SSR e compatibilidade browser

Componentes que usam APIs do browser (`window`, `setInterval`, `sessionStorage`) verificam:

```typescript
isPlatformBrowser(this.platformId)
```

Isso evita erros durante prerender/SSR. O dashboard **não carrega dados** no servidor — só no browser.

---

## 12. Testes

| Arquivo | Cobertura |
|---------|-----------|
| `dashboard.mock.spec.ts` | `resolverTurnoAtual()` |
| `cpf.util.spec.ts` | Validação/formatação CPF |

Não há testes de componentes ou integração Supabase.

---

## 13. Como rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Subir frontend
npm start

# 3. Acessar
# http://localhost:4200          → Landing
# http://localhost:4200/admin    → Login
# http://localhost:4200/dashboard → Painel (requer auth)
```

### Testar dashboard rapidamente

1. `/admin` → senha `admin123` → criar operador → anotar ID gerado  
   **OU** `/admin` → senha `admin123` → clicar "Abrir Dashboard"  
   **OU** `/admin` → informar ID de operador existente

---

## 14. Limitações conhecidas (MVP)

| Área | Limitação |
|------|-----------|
| Segurança | Senhas/códigos no frontend; RLS permissivo |
| Auth | Sem Supabase Auth, JWT ou refresh token |
| Landing | Desconectada do backend real |
| IA preditiva | Dados estáticos/semeados, não ML real |
| E-Stop | Simulação via `prompt`/`alert`, sem integração PLC |
| Tempo real | Polling 30s, não WebSocket |
| Produção | `producao_diaria` precisa ser alimentada externamente |
| Branding histórico | Nome do repo ainda contém "Axion"; UI usa "Axiom" |

---

## 15. Roadmap sugerido (evolução)

1. Supabase Auth (operadores + admin com roles)
2. RLS restritivo por role/autenticação
3. Variáveis sensíveis via secrets (não no bundle)
4. WebSocket / Supabase Realtime para tanques e logs
5. Ingestão automática de `producao_diaria` (IoT/PLC)
6. Testes E2E (Playwright/Cypress)
7. Deploy SSR (Vercel, Railway, etc.)

---

## 16. Referências rápidas para agentes IA

Ao modificar este projeto, priorize:

1. **`SupabaseService`** — única fonte de dados; preserve fallbacks mock
2. **`operadorGuard` + `AuthService`** — qualquer rota nova protegida deve seguir o mesmo padrão
3. **`environment.ts`** — nunca hardcodar credenciais em componentes
4. **`supabase/schema.sql`** — manter sincronizado com métodos do service
5. **SSR** — sempre guardar APIs de browser com `isPlatformBrowser`
6. **Standalone components** — padrão Angular 19 do projeto; sem NgModules

### Arquivos mais críticos

```
src/app/services/supabase.service.ts   # Dados
src/app/pages/dashboard/dashboard.component.ts  # Lógica principal
src/app/pages/admin/admin.component.ts   # CRUD + login
src/app/app.routes.ts                    # Rotas
supabase/schema.sql                      # Contrato do banco
```

---

*Documento gerado para orientar desenvolvedores e assistentes IA sobre o estado atual do Axiom Control.*
