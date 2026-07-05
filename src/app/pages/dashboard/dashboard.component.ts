import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import {
  HistoricoTemperaturaPonto,
  LogOcorrencia,
  ProjecaoIa,
  TanqueStatus,
  calcularAlturaBarra,
  mapearStatusParaClasses
} from '../../mocks/dashboard.mock';

interface TanqueView extends TanqueStatus {
  classCard: string;
  classTemp: string;
  classStatus: string;
  barraClasse: string;
}

interface GraficoTanqueView {
  titulo: string;
  pontos: Array<HistoricoTemperaturaPonto & { altura: number }>;
  horarios: string[];
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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  tanques: TanqueView[] = [];
  graficos: GraficoTanqueView[] = [];
  logs: LogOcorrencia[] = [];
  logsTurno: LogOcorrencia[] = [];
  projecoesIa: ProjecaoIa[] = [];
  turnoAtual: TurnoAtualView | null = null;
  escalaTurnos: TurnoEscalaView[] = [];
  logoTurno = 'AXIOM CONTROL';

  carregando = true;
  enviandoOcorrencia = false;
  enviandoRelatorio = false;
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
  mensagemRelatorio = '';

  private ultimoSyncEm = Date.now();
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) {
      this.carregando = false;
      return;
    }

    await this.carregarDashboard();
    this.syncInterval = setInterval(() => this.atualizarUltimoSync(), 1000);
  }

  ngOnDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }

  async carregarDashboard() {
    this.carregando = true;

    const [tanques, logs, projecoes, operariosTurno] = await Promise.all([
      this.supabaseService.obterStatusTanques(),
      this.supabaseService.obterLogOcorrencias(),
      this.supabaseService.obterProjecoesIa(),
      this.supabaseService.obterOperariosParaTurnos()
    ]);

    this.tanques = tanques.map((tanque) => ({
      ...tanque,
      ...mapearStatusParaClasses(tanque.status)
    }));

    this.logs = logs;
    this.projecoesIa = projecoes;
    this.escalaTurnos = this.montarEscalaTurnos(operariosTurno);
    this.atualizarTurnoEmTempoReal();
    this.logsTurno = this.turnoAtual ? await this.supabaseService.obterLogsDoTurno(this.turnoAtual.id) : [];

    const pontosSemana = await this.supabaseService.obterMediaSemanalTanques();
    this.graficos = [this.montarGraficoSemanal(pontosSemana)];
    this.recalcularIndicadores();
    this.ultimoSyncEm = Date.now();
    this.ultimoSync = 'agora';
    this.carregando = false;
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
      this.mensagemEnvio = 'Notificação enviada para o operador.';
      this.descricaoOcorrencia = '';
      this.tanquesSelecionados = {
        'Tanque 01': false,
        'Tanque 02': false,
        'Tanque 03': false
      };
    } else {
      this.mensagemEnvio = 'Falha ao enviar notificação. Tente novamente.';
    }

    this.enviandoOcorrencia = false;
  }

  async ativarEStop(tanque: TanqueView) {
    const resposta = window.prompt('Digite o código de segurança para ativar o E-Stop:');

    if (resposta === 'senhabraba') {
      window.alert(`E-Stop ativado em ${tanque.nome}: O sistema foi desligado com sucesso.`);

      if (this.turnoAtual) {
        await this.supabaseService.adicionarLog(
          this.turnoAtual.id,
          'Paragem de Emergencia acionada na linha principal',
          'critico'
        );
        this.logsTurno = await this.supabaseService.obterLogsDoTurno(this.turnoAtual.id);
      }
    }
  }

  async testarEnvioRelatorio() {
    this.enviandoRelatorio = true;
    this.mensagemRelatorio = '';

    const sucesso = await this.supabaseService.enviarRelatorioEmail();

    this.mensagemRelatorio = sucesso
      ? 'Relatorio semanal enviado para afonso.oliveira2301@gmail.com.'
      : 'Falha ao enviar relatorio semanal. Verifique a Edge Function send-weekly-pdf.';
    this.enviandoRelatorio = false;
  }

  classeProjecaoIa(tipo: ProjecaoIa['tipo']): string {
    switch (tipo) {
      case 'alerta-critico':
        return 'log-ia-alerta-critico';
      case 'alerta-moderado':
        return 'log-ia-alerta-moderado';
      default:
        return 'log-ia-predicao';
    }
  }

  private montarGraficoSemanal(pontos: HistoricoTemperaturaPonto[]): GraficoTanqueView {
    const pontosComAltura = pontos.map((ponto) => ({
      ...ponto,
      altura: calcularAlturaBarra(ponto.temperatura),
      perigo: ponto.perigo ?? ponto.temperatura >= 85
    }));

    return {
      titulo: 'Media semanal real dos 3 tanques',
      pontos: pontosComAltura,
      horarios: pontosComAltura.map((ponto) => ponto.horario)
    };
  }

  private recalcularIndicadores() {
    this.tanquesAtivos = this.tanques.filter((tanque) => tanque.status !== 'manutencao').length;
    this.alertasAtivos =
      this.tanques.filter((tanque) => tanque.status === 'critico').length +
      this.logs.filter((log) => log.tipo === 'alerta' || log.tipo === 'erro').length;
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
}
