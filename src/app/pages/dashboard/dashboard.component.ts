import { Component, ElementRef, Inject, NgZone, OnDestroy, OnInit, AfterViewInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  SupabaseService,
  ProducaoDiariaRegistro,
  OperarioTurno,
  RelatorioTelegramPayload
} from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import {
  LogOcorrencia,
  TanqueStatus,
  calcularAlturaBarra,
  mapearStatusParaClasses
} from '../../mocks/dashboard.mock';
import {
  formatarHorarioTurno,
  normalizarTurnoOperario,
  parseHoraTurno,
  periodoFromTurnoCadastro,
  turnoCadastroEstaAtivo,
  turnoEstaAtivo
} from '../../utils/turno.util';

interface TanqueView extends TanqueStatus {
  classCard: string;
  classTemp: string;
  classStatus: string;
  barraClasse: string;
}

interface KpiView {
  temperaturaMedia: number;
  nivel: number;
  eficienciaOee: number;
  alertas: number;
  dataExibida: string;
}

interface BarraTanqueGrafico {
  codigo: string;
  nome: string;
  temperatura: number;
  altura: number;
  perigo: boolean;
  classe: string;
}

interface DiaGraficoView {
  dataRegistro: string;
  label: string;
  diaSemana: string;
  semDados: boolean;
  barras: BarraTanqueGrafico[];
}

interface SemanaFiltro {
  valor: number;
  label: string;
}

interface MesFiltro {
  valor: string;
  label: string;
}

interface TurnoAtualView {
  id: string | number;
  operario: string;
  horario: string;
  status: string;
  turno: string;
}

interface TurnoEscalaView {
  id: string | number;
  operario: string;
  turno: string;
  horario: string;
  inicio: number;
  fim: number;
  ativo: boolean;
}

interface SecaoNav {
  id: string;
  label: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  tanques: TanqueView[] = [];
  graficoDiasSemana: DiaGraficoView[] = [];
  logs: LogOcorrencia[] = [];
  logsTurno: LogOcorrencia[] = [];
  turnoAtual: TurnoAtualView | null = null;
  turnoIndisponivelMsg = '';
  escalaTurnos: TurnoEscalaView[] = [];

  kpis: KpiView = {
    temperaturaMedia: 0,
    nivel: 0,
    eficienciaOee: 0,
    alertas: 0,
    dataExibida: '--/--/----'
  };

  mesesDisponiveis: MesFiltro[] = [
    { valor: '04', label: 'Abril (04)' },
    { valor: '05', label: 'Maio (05)' },
    { valor: '06', label: 'Junho (06)' }
  ];
  mesSelecionado = '04';
  semanaSelecionada = 1;
  semanasDisponiveis: SemanaFiltro[] = [];
  tituloGraficoSemana = '';

  carregando = true;
  enviandoOcorrencia = false;
  enviandoTelegram: boolean = false;
  descricaoOcorrencia = '';
  tanquesSelecionados: Record<string, boolean> = {
    'Tanque 01': false,
    'Tanque 02': false,
    'Tanque 03': false
  };

  tanquesAtivos = 0;
  alertasAtivos = 0;
  uptime = '99.97%';
  ultimoSync = 'agora';
  mensagemEnvio = '';
  mensagemTelegram: string = '';
  progressoDiaLabel = '';

  readonly secoesNav: SecaoNav[] = [
    { id: 'kpis', label: 'Indicadores' },
    { id: 'tanques', label: 'Tanques' },
    { id: 'graficos', label: 'Graficos' },
    { id: 'turnos', label: 'Diario de Bordo' },
    { id: 'emergencia', label: 'Ocorrencias' }
  ];
  secaoAtiva = 'kpis';
  sidebarAberta = false;
  operadorNome = '';
  isAdmin = false;

  private historicoProducao: ProducaoDiariaRegistro[] = [];
  private registroDiaAnterior: ProducaoDiariaRegistro | null = null;
  private indiceDiaAtual = 0;
  private ultimoSyncEm = Date.now();
  private inicioSessao = Date.now();
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private diaInterval: ReturnType<typeof setInterval> | null = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private secaoObserver: IntersectionObserver | null = null;

  private readonly tanquesGrafico = [
    { codigo: 'TK-001', nome: 'Tanque 01', campo: 'temperatura_t1' as const, classe: 'barra-t1' },
    { codigo: 'TK-002', nome: 'Tanque 02', campo: 'temperatura_t2' as const, classe: 'barra-t2' },
    { codigo: 'TK-003', nome: 'Tanque 03', campo: 'temperatura_t3' as const, classe: 'barra-t3' }
  ];

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private router: Router,
    private ngZone: NgZone,
    private el: ElementRef<HTMLElement>
  ) {}

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) {
      this.carregando = false;
      return;
    }

    this.inicioSessao = Date.now();
    const operador = this.authService.getOperador();
    this.operadorNome = operador?.nome ?? (this.authService.isAdminLoggedIn() ? 'Administrador' : '');
    this.isAdmin = this.authService.isAdminLoggedIn();
    await this.carregarDashboard();

    this.syncInterval = setInterval(() => {
      this.atualizarUltimoSync();
      this.atualizarUptime();
    }, 1000);

    this.diaInterval = setInterval(() => void this.avancarDiaSimulado(), 10000);

    this.refreshInterval = setInterval(
      () => this.atualizarDadosOperacionais(true),
      environment.dashboardRefreshMs
    );
  }

  ngAfterViewInit() {
    if (!this.carregando) {
      this.iniciarObservadorSecoes();
    }
  }

  ngOnDestroy() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.diaInterval) clearInterval(this.diaInterval);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.secaoObserver?.disconnect();
  }

  navegarPara(secaoId: string) {
    const main = this.obterAreaScroll();
    const elemento = document.getElementById(secaoId);
    if (!elemento || !main) {
      return;
    }

    this.secaoAtiva = secaoId;
    this.sidebarAberta = false;

    const mainRect = main.getBoundingClientRect();
    const elRect = elemento.getBoundingClientRect();
    const destino = main.scrollTop + (elRect.top - mainRect.top) - 12;
    main.scrollTo({ top: Math.max(0, destino), behavior: 'smooth' });
  }

  sair() {
    this.authService.logout();
    void this.router.navigate(['/']);
  }

  private iniciarObservadorSecoes() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const main = this.obterAreaScroll();
    if (!main) {
      return;
    }

    this.secaoObserver?.disconnect();
    this.secaoObserver = new IntersectionObserver(
      (entries) => {
        const visivel = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visivel?.target.id) {
          this.ngZone.run(() => {
            this.secaoAtiva = visivel.target.id;
          });
        }
      },
      { root: main, rootMargin: '-10% 0px -60% 0px', threshold: [0.1, 0.35, 0.6] }
    );

    for (const secao of this.secoesNav) {
      const elemento = document.getElementById(secao.id);
      if (elemento) {
        this.secaoObserver.observe(elemento);
      }
    }
  }

  private obterAreaScroll(): HTMLElement | null {
    return this.el.nativeElement.querySelector('main');
  }

  async carregarDashboard() {
    this.carregando = true;

    this.historicoProducao = await this.supabaseService.obterHistoricoProducao();
    this.indiceDiaAtual = 0;

    await this.atualizarDadosOperacionais(false);
    this.aplicarRegistroDoDia(this.historicoProducao[this.indiceDiaAtual], null);
    this.atualizarFiltrosGrafico();

    this.carregando = false;
    setTimeout(() => this.iniciarObservadorSecoes(), 0);
  }

  onMesSelecionadoChange() {
    this.semanaSelecionada = 1;
    this.atualizarFiltrosGrafico();
  }

  onSemanaSelecionadaChange() {
    this.atualizarGraficoSemana();
  }

  async enviarNotificacao() {
    const tanquesMarcados = Object.entries(this.tanquesSelecionados)
      .filter(([, marcado]) => marcado)
      .map(([nome]) => nome);

    if (!this.descricaoOcorrencia.trim()) {
      this.mensagemEnvio = 'Descreva a ocorrência antes de enviar.';
      return;
    }

    this.enviandoOcorrencia = true;
    this.mensagemEnvio = '';

    const sucesso = await this.supabaseService.enviarOcorrencia(this.descricaoOcorrencia, tanquesMarcados);

    if (sucesso) {
      const descricao = this.descricaoOcorrencia.trim();
      const tanquesTxt = tanquesMarcados.length ? tanquesMarcados.join(', ') : 'Nenhum tanque';
      this.mensagemEnvio = 'Notificação enviada e incluída no próximo relatório semanal.';
      this.descricaoOcorrencia = '';
      this.tanquesSelecionados = {
        'Tanque 01': false,
        'Tanque 02': false,
        'Tanque 03': false
      };
      await this.registrarEventoSistema(
        `[OPERADOR] Ocorrência reportada em ${tanquesTxt}: ${descricao}`,
        'alerta'
      );

      if (this.turnoAtual) {
        await this.supabaseService.adicionarLog(
          this.turnoAtual.id,
          `[OPERADOR] Ocorrência em ${tanquesTxt}: ${descricao}`,
          'alerta'
        );
        this.logsTurno = await this.supabaseService.obterLogsDoTurno(this.turnoAtual.id);
      }
    } else {
      this.mensagemEnvio = 'Falha ao enviar notificação. Tente novamente.';
    }

    this.enviandoOcorrencia = false;
  }

  async ativarEStop(tanque: TanqueView) {
    const resposta = window.prompt('Digite o código de segurança para ativar o E-Stop:');

    if (resposta === environment.eStopCode) {
      window.alert(`E-Stop ativado em ${tanque.nome}: O sistema foi desligado com sucesso.`);

      if (this.turnoAtual) {
        await this.supabaseService.adicionarLog(
          this.turnoAtual.id,
          'Paragem de Emergencia acionada na linha principal',
          'critico'
        );
        this.logsTurno = await this.supabaseService.obterLogsDoTurno(this.turnoAtual.id);
      }

      await this.registrarEventoSistema(
        `[E-STOP] Paragem de emergência acionada em ${tanque.codigo} — ${tanque.nome}.`,
        'critico'
      );
    } else if (resposta !== null) {
      window.alert('Código de segurança inválido. E-Stop não foi acionado.');
    }
  }

  async enviarParaTelegram() {
    this.enviandoTelegram = true;
    this.mensagemTelegram = '';

    const periodo = this.kpis.dataExibida && this.kpis.dataExibida !== '--/--/----'
      ? this.kpis.dataExibida
      : this.tituloGraficoSemana;

    const dados: RelatorioTelegramPayload = {
      periodo,
      oeeMedio: this.kpis.eficienciaOee,
      totalAlertas: this.alertasAtivos,
      temperaturaMedia: this.kpis.temperaturaMedia,
      nivelMedio: this.kpis.nivel
    };

    try {
      await this.supabaseService.enviarRelatorioTelegram(dados);
      this.mensagemTelegram = 'Relatório atual enviado para o Telegram.';
    } catch (error) {
      console.error('Erro ao enviar relatorio para Telegram:', error);
      const detalhe = error instanceof Error ? error.message : 'Erro desconhecido ao enviar o relatório.';
      this.mensagemTelegram = `Falha ao enviar relatório para o Telegram: ${detalhe}`;
    } finally {
      this.enviandoTelegram = false;
    }
  }

  private async atualizarDadosOperacionais(silencioso: boolean) {
    const operariosTurno = await this.supabaseService.obterOperariosParaTurnos();

    this.escalaTurnos = this.montarEscalaTurnos(operariosTurno);
    await this.atualizarTurnoEmTempoReal(!silencioso);
    this.logsTurno = this.turnoAtual?.id
      ? await this.supabaseService.obterLogsDoTurno(this.turnoAtual.id)
      : [];
    this.logs = await this.supabaseService.obterLogOcorrencias();

    if (!silencioso) {
      this.ultimoSyncEm = Date.now();
      this.ultimoSync = 'agora';
    }

    this.recalcularIndicadores();
  }

  private async avancarDiaSimulado() {
    if (!this.historicoProducao.length) {
      return;
    }

    if (this.indiceDiaAtual < this.historicoProducao.length - 1) {
      this.indiceDiaAtual++;
    }

    const anterior = this.registroDiaAnterior;
    const atual = this.historicoProducao[this.indiceDiaAtual];
    await this.aplicarRegistroDoDia(atual, anterior);
    this.ultimoSyncEm = Date.now();
    this.ultimoSync = 'agora';
    this.recalcularIndicadores();
  }

  private async aplicarRegistroDoDia(
    registro?: ProducaoDiariaRegistro,
    anterior: ProducaoDiariaRegistro | null = null
  ) {
    if (!registro) {
      return;
    }

    this.kpis = {
      temperaturaMedia: registro.temperatura,
      nivel: registro.nivel,
      eficienciaOee: this.supabaseService.calcularOee(registro),
      alertas: registro.alertas,
      dataExibida: this.formatarDataCompleta(registro.data_registro)
    };

    this.progressoDiaLabel = `Dia ${this.indiceDiaAtual + 1} de ${this.historicoProducao.length} — ${this.kpis.dataExibida}`;

    const tanquesBase = this.mapearRegistroParaTanques(registro);
    this.tanques = tanquesBase.map((tanque) => ({
      ...tanque,
      ...mapearStatusParaClasses(tanque.status)
    }));

    await this.registrarEventosDoRegistro(registro, anterior);
    this.registroDiaAnterior = { ...registro };
  }

  private async registrarEventoSistema(mensagem: string, tipo: LogOcorrencia['tipo'] = 'info') {
    await this.supabaseService.registrarLogOcorrencia(mensagem, tipo);

    if (this.turnoAtual?.id) {
      await this.supabaseService.adicionarLog(this.turnoAtual.id, mensagem, tipo);
    }

    this.logs = await this.supabaseService.obterLogOcorrencias();

    if (this.turnoAtual?.id) {
      this.logsTurno = await this.supabaseService.obterLogsDoTurno(this.turnoAtual.id);
    }
  }

  private async registrarEventosDoRegistro(
    registro: ProducaoDiariaRegistro,
    anterior: ProducaoDiariaRegistro | null
  ) {
    const data = this.formatarDataCompleta(registro.data_registro);
    const eventos: Array<{ mensagem: string; tipo: LogOcorrencia['tipo'] }> = [];

    if (!anterior) {
      eventos.push({
        mensagem: `[SISTEMA] Sincronização iniciada — exibindo produção de ${data}.`,
        tipo: 'info'
      });
    } else {
      eventos.push({
        mensagem: `[SISTEMA] Avanço para ${data} — OEE ${this.supabaseService.calcularOee(registro)}%.`,
        tipo: 'info'
      });

      if (registro.alertas > anterior.alertas) {
        eventos.push({
          mensagem: `[ALERTA] ${registro.alertas - anterior.alertas} novo(s) alerta(s) registrado(s) em ${data}.`,
          tipo: 'alerta'
        });
      }

      if (registro.temperatura_t2 >= 85 && anterior.temperatura_t2 < 85) {
        eventos.push({
          mensagem: `[TANQUE 02] Temperatura crítica atingida: ${registro.temperatura_t2}°C em ${data}.`,
          tipo: 'erro'
        });
      }

      if (registro.temperatura_t1 >= 85 && anterior.temperatura_t1 < 85) {
        eventos.push({
          mensagem: `[TANQUE 01] Limite térmico excedido: ${registro.temperatura_t1}°C em ${data}.`,
          tipo: 'erro'
        });
      }

      if (registro.nivel < anterior.nivel - 10) {
        eventos.push({
          mensagem: `[NIVEL] Queda significativa de nível: ${anterior.nivel}% → ${registro.nivel}% em ${data}.`,
          tipo: 'alerta'
        });
      }

      if (registro.alertas === 0 && anterior.alertas > 0) {
        eventos.push({
          mensagem: `[SISTEMA] Alertas normalizados em ${data} — operação estável.`,
          tipo: 'sucesso'
        });
      }
    }

    if (registro.temperatura_t3 < 30 && (!anterior || anterior.temperatura_t3 >= 30)) {
      eventos.push({
        mensagem: `[TANQUE 03] Modo manutenção — ${registro.temperatura_t3}°C em ${data}.`,
        tipo: 'info'
      });
    }

    const oee = this.supabaseService.calcularOee(registro);
    if (oee >= 92 && (!anterior || this.supabaseService.calcularOee(anterior) < 92)) {
      eventos.push({
        mensagem: `[PRODUÇÃO] Eficiência elevada (${oee}%) confirmada em ${data}.`,
        tipo: 'sucesso'
      });
    }

    for (const evento of eventos) {
      await this.supabaseService.registrarLogOcorrencia(evento.mensagem, evento.tipo);
    }

    if (eventos.length) {
      this.logs = await this.supabaseService.obterLogOcorrencias();
    }
  }

  private mapearRegistroParaTanques(registro: ProducaoDiariaRegistro): TanqueStatus[] {
    const statusT1 = registro.temperatura_t1 >= 85 ? 'critico' : 'normal';
    const statusT2 = registro.temperatura_t2 >= 85 || registro.alertas > 0 ? 'critico' : 'normal';
    const statusT3 = registro.temperatura_t3 < 30 ? 'manutencao' : 'normal';

    return [
      {
        codigo: 'TK-001',
        linha: 'LINHA A',
        nome: 'Tanque 01 — Misturador',
        temperatura: registro.temperatura_t1,
        nivel: registro.nivel,
        status: statusT1,
        statusTexto: statusT1 === 'critico' ? 'CRÍTICO — SUPERAQUECIMENTO' : 'OPERANDO — NORMAL'
      },
      {
        codigo: 'TK-002',
        linha: 'LINHA B',
        nome: 'Tanque 02 — Reator Químico',
        temperatura: registro.temperatura_t2,
        nivel: Math.max(20, Math.round(registro.nivel * 0.6)),
        status: statusT2,
        statusTexto: statusT2 === 'critico' ? 'CRÍTICO — SUPERAQUECIMENTO' : 'OPERANDO — NORMAL'
      },
      {
        codigo: 'TK-003',
        linha: 'LINHA C',
        nome: 'Tanque 03 — Armazenamento',
        temperatura: registro.temperatura_t3,
        nivel: Math.max(5, Math.round(registro.nivel * 0.1)),
        status: statusT3,
        statusTexto: statusT3 === 'manutencao' ? 'EM MANUTENÇÃO' : 'OPERANDO — NORMAL'
      }
    ];
  }

  private atualizarFiltrosGrafico() {
    this.atualizarSemanasDisponiveis();

    const semanaValida = this.semanasDisponiveis.some((s) => s.valor === this.semanaSelecionada);
    if (!semanaValida && this.semanasDisponiveis.length) {
      this.semanaSelecionada = this.semanasDisponiveis[0].valor;
    }

    this.atualizarGraficoSemana();
  }

  private atualizarSemanasDisponiveis() {
    const registrosMes = this.historicoProducao.filter(
      (row) => this.extrairMes(row.data_registro) === this.mesSelecionado
    );

    const numerosSemana = new Set<number>();
    for (const registro of registrosMes) {
      numerosSemana.add(this.obterNumeroSemanaDoMes(registro.data_registro));
    }

    if (!numerosSemana.size) {
      const diasNoMes = this.diasNoMes(this.mesSelecionado);
      for (let dia = 1; dia <= diasNoMes; dia++) {
        numerosSemana.add(Math.ceil(dia / 7));
      }
    }

    this.semanasDisponiveis = Array.from(numerosSemana)
      .sort((a, b) => a - b)
      .map((numero) => {
        const { diaInicio, diaFim } = this.obterIntervaloSemana(numero, this.mesSelecionado);
        return {
          valor: numero,
          label: `Semana ${numero} do mês ${this.mesSelecionado} (${String(diaInicio).padStart(2, '0')}-${String(diaFim).padStart(2, '0')})`
        };
      });
  }

  private atualizarGraficoSemana() {
    const diasNoMes = this.diasNoMes(this.mesSelecionado);
    const diaInicio = (this.semanaSelecionada - 1) * 7 + 1;
    const diaFim = Math.min(this.semanaSelecionada * 7, diasNoMes);

    this.tituloGraficoSemana = `Semana ${this.semanaSelecionada} do mês ${this.mesSelecionado}/2026 (${String(diaInicio).padStart(2, '0')} a ${String(diaFim).padStart(2, '0')})`;

    const mapaRegistros = new Map<string, ProducaoDiariaRegistro>();
    for (const registro of this.historicoProducao) {
      if (this.extrairMes(registro.data_registro) === this.mesSelecionado) {
        mapaRegistros.set(registro.data_registro, registro);
      }
    }

    const nomesDia = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    this.graficoDiasSemana = Array.from({ length: 7 }, (_, indice) => {
      const dia = diaInicio + indice;

      if (dia > diasNoMes) {
        return {
          dataRegistro: '',
          label: '—',
          diaSemana: '',
          semDados: true,
          barras: []
        };
      }

      const dataRegistro = `2026-${this.mesSelecionado}-${String(dia).padStart(2, '0')}`;
      const registro = mapaRegistros.get(dataRegistro);
      const data = new Date(`${dataRegistro}T12:00:00`);

      if (!registro) {
        return {
          dataRegistro,
          label: String(dia).padStart(2, '0'),
          diaSemana: nomesDia[data.getDay()],
          semDados: true,
          barras: []
        };
      }

      return {
        dataRegistro,
        label: String(dia).padStart(2, '0'),
        diaSemana: nomesDia[data.getDay()],
        semDados: false,
        barras: this.tanquesGrafico.map((tanque) => {
          const temperatura = registro[tanque.campo];
          return {
            codigo: tanque.codigo,
            nome: tanque.nome,
            temperatura,
            altura: calcularAlturaBarra(temperatura),
            perigo: temperatura >= 85,
            classe: tanque.classe
          };
        })
      };
    });
  }

  private obterNumeroSemanaDoMes(dataRegistro: string): number {
    const dia = Number(dataRegistro.split('-')[2] ?? 1);
    return Math.ceil(dia / 7);
  }

  private obterIntervaloSemana(numeroSemana: number, mes: string) {
    const diasNoMes = this.diasNoMes(mes);
    const diaInicio = (numeroSemana - 1) * 7 + 1;
    const diaFim = Math.min(numeroSemana * 7, diasNoMes);
    return { diaInicio, diaFim };
  }

  private diasNoMes(mes: string): number {
    const mapa: Record<string, number> = { '04': 30, '05': 31, '06': 30 };
    return mapa[mes] ?? 30;
  }

  private extrairMes(dataRegistro: string): string {
    const partes = dataRegistro.split('-');
    return partes.length >= 2 ? partes[1] : '';
  }

  private formatarDataCurta(dataRegistro: string): string {
    const partes = dataRegistro.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}`;
    }
    return dataRegistro;
  }

  private formatarDataCompleta(dataRegistro: string): string {
    const partes = dataRegistro.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataRegistro;
  }

  private montarEscalaTurnos(operarios: Record<string, unknown>[]): TurnoEscalaView[] {
    const horaAtual = new Date().getHours();

    if (!operarios.length) {
      return [];
    }

    return operarios.map((operario) => {
      const turno = normalizarTurnoOperario(operario);
      const inicio = parseHoraTurno(turno.turno_inicio);
      const fim = parseHoraTurno(turno.turno_fim);

      return {
        id: String(operario['id_gerado'] ?? ''),
        operario: String(operario['nome'] ?? 'Sem operador cadastrado'),
        turno: turno.turno_nome,
        horario: formatarHorarioTurno(turno.turno_inicio, turno.turno_fim),
        inicio,
        fim,
        ativo: turnoEstaAtivo(horaAtual, inicio, fim)
      };
    });
  }

  private async atualizarTurnoEmTempoReal(registrarAssuncao = true) {
    const operadorSessao = this.authService.getOperador();
    let operarioTurno: OperarioTurno | null = null;

    if (operadorSessao?.id_gerado) {
      const operarioDb = await this.supabaseService.verificarId(operadorSessao.id_gerado);
      if (operarioDb) {
        const turno = normalizarTurnoOperario(operarioDb as Record<string, unknown>);
        operarioTurno = {
          nome: String(operarioDb['nome'] ?? operadorSessao.nome),
          ...turno
        };
      }
    }

    const turnoDb = await this.supabaseService.sincronizarTurnoAtual(operarioTurno, {
      registrarAssuncao
    });

    this.turnoIndisponivelMsg = '';

    if (turnoDb) {
      this.turnoAtual = this.mapearTurnoAtual(turnoDb);
      return;
    }

    const turnoExistente = await this.supabaseService.obterTurnoAtual();
    if (turnoExistente) {
      this.turnoAtual = this.mapearTurnoAtual(turnoExistente);
      if (operarioTurno && !turnoCadastroEstaAtivo(operarioTurno)) {
        this.turnoIndisponivelMsg = 'Turno da fábrica em andamento — você está fora do seu horário.';
      }
      return;
    }

    if (operarioTurno) {
      const periodo = periodoFromTurnoCadastro(operarioTurno);
      const dentroDoTurno = turnoCadastroEstaAtivo(operarioTurno);

      this.turnoAtual = {
        id: 0,
        operario: operarioTurno.nome,
        horario: periodo.horario,
        status: dentroDoTurno ? 'aguardando_inicio' : 'fora_do_horario',
        turno: operarioTurno.turno_nome
      };
      this.turnoIndisponivelMsg = dentroDoTurno
        ? 'Dentro do horário — aguardando abertura do turno no banco.'
        : 'Fora do horário cadastrado para o seu turno.';
      return;
    }

    this.turnoAtual = null;
    this.turnoIndisponivelMsg = 'Entre com seu ID de operador em /login para iniciar um turno.';
  }

  private mapearTurnoAtual(turnoDb: Record<string, unknown>): TurnoAtualView {
    return {
      id: Number(turnoDb['id']),
      operario: String(turnoDb['operario_nome'] ?? 'Desconhecido'),
      horario: String(turnoDb['horario'] ?? '--:-- - --:--'),
      status: String(turnoDb['status'] ?? 'em_andamento'),
      turno: String(turnoDb['turno'] ?? '')
    };
  }

  private recalcularIndicadores() {
    this.tanquesAtivos = this.tanques.filter((tanque) => tanque.status !== 'manutencao').length;
    this.alertasAtivos =
      this.kpis.alertas + this.logs.filter((log) => log.tipo === 'alerta' || log.tipo === 'erro').length;
  }

  private atualizarUltimoSync() {
    const segundos = Math.floor((Date.now() - this.ultimoSyncEm) / 1000);

    if (segundos <= 1) {
      this.ultimoSync = 'agora';
      return;
    }

    if (segundos < 60) {
      this.ultimoSync = `${segundos}s atrás`;
      return;
    }

    const minutos = Math.floor(segundos / 60);
    this.ultimoSync = `${minutos}min atrás`;
  }

  private atualizarUptime() {
    const minutosOnline = (Date.now() - this.inicioSessao) / 60000;
    const uptimePercent = Math.min(99.99, 99.9 + minutosOnline * 0.001);
    this.uptime = `${uptimePercent.toFixed(2)}%`;
  }
}
