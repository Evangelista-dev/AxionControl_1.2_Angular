import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { OperarioMock } from '../mocks/operarios.mock';
import {
  HistoricoTemperaturaPonto,
  LogOcorrencia,
  PeriodoTurno,
  StatusTanque,
  TanqueStatus,
  historicoTemperaturaMock,
  tanquesStatusMock
} from '../mocks/dashboard.mock';
import {
  TurnoCadastro,
  periodoFromTurnoCadastro,
  turnoCadastroEstaAtivo
} from '../utils/turno.util';

export interface OperarioTurno extends TurnoCadastro {
  nome: string;
}

export interface ProducaoDiariaRegistro {
  data_registro: string;
  temperatura_t1: number;
  temperatura_t2: number;
  temperatura_t3: number;
  temperatura: number;
  nivel: number;
  alertas: number;
}

export interface OcorrenciaOperador {
  descricao: string;
  tanques: string[];
  created_at: string;
}

export interface ResumoSemanal {
  oeeMedio: number;
  totalAlertas: number;
  temperaturaMedia: number;
  nivelMedio: number;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient | null = null;
  private useMockData = true;
  private mockOperarios: OperarioMock[] = [];
  private historicoSemanal: ProducaoDiariaRegistro[] = [];

  constructor() {
    if (typeof window === 'undefined') {
      this.useMockData = true;
      return;
    }

    try {
      this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
      this.useMockData = false;
    } catch (error) {
      console.warn('Falha ao inicializar Supabase, usando dados mockados.', error);
      this.useMockData = true;
    }
  }

  private isBrowserRuntime(): boolean {
    return typeof window !== 'undefined' && typeof window.fetch === 'function';
  }

  async listarOperarios() {
    if (this.useMockData || !this.supabase) {
      return this.mockOperarios;
    }

    const { data, error } = await this.supabase.from('operarios').select('*');
    if (error) {
      console.error('Erro ao listar:', error.message);
      return [];
    }
    return data ?? [];
  }

  async cadastrarOperario(
    id_gerado: string,
    nome: string,
    cpf: string,
    turno: TurnoCadastro = {
      turno_nome: 'Manhã',
      turno_inicio: '06:00',
      turno_fim: '14:00'
    }
  ) {
    if (this.useMockData || !this.supabase) {
      this.mockOperarios.unshift({
        id_gerado,
        nome,
        cpf,
        turno_nome: turno.turno_nome,
        turno_inicio: turno.turno_inicio,
        turno_fim: turno.turno_fim,
        created_at: new Date().toISOString()
      });
      return true;
    }

    const { error } = await this.supabase.from('operarios').insert([
      {
        id_gerado,
        nome,
        cpf,
        turno_nome: turno.turno_nome,
        turno_inicio: turno.turno_inicio,
        turno_fim: turno.turno_fim,
        created_at: new Date().toISOString()
      }
    ]);

    if (error) {
      console.error('Erro ao cadastrar:', error.message);
      return false;
    }
    return true;
  }

  async deletarOperario(id: string) {
    if (this.useMockData || !this.supabase) {
      this.mockOperarios = this.mockOperarios.filter((operario) => operario.id_gerado !== id);
      return true;
    }

    const { error } = await this.supabase.from('operarios').delete().eq('id_gerado', id);
    if (error) {
      console.error('Erro ao deletar:', error.message);
      return false;
    }
    return true;
  }

  async limparTodosOperarios() {
    if (this.useMockData || !this.supabase) {
      this.mockOperarios = [];
      return true;
    }

    const { error } = await this.supabase.from('operarios').delete().not('id_gerado', 'is', null);
    if (error) {
      console.error('Erro ao limpar banco:', error.message);
      return false;
    }
    return true;
  }

  async verificarId(id_gerado: string) {
    if (this.useMockData || !this.supabase) {
      return this.mockOperarios.find((operario) => operario.id_gerado.toUpperCase() === id_gerado.toUpperCase()) || null;
    }

    const idNormalizado = id_gerado.toUpperCase();
    const { data, error } = await this.supabase
      .from('operarios')
      .select('*')
      .eq('id_gerado', idNormalizado)
      .single();

    if (error || !data) {
      console.error('Erro no login/ID não encontrado:', error?.message);
      return null;
    }
    return data;
  }

  async obterHistoricoProducao(): Promise<ProducaoDiariaRegistro[]> {
    if (!this.supabase || !this.isBrowserRuntime()) {
      return this.gerarProducaoDiariaMock();
    }

    const { data, error } = await this.supabase
      .from('producao_diaria')
      .select('*')
      .order('data_registro', { ascending: true });

    if (error) {
      console.error('Erro ao buscar histórico industrial:', error.message);
      return this.gerarProducaoDiariaMock();
    }

    const registros = (data ?? []).map((row) => this.normalizarProducaoDiaria(row));

    if (!registros.length) {
      return this.gerarProducaoDiariaMock();
    }

    this.historicoSemanal = registros;
    return registros;
  }

  async obterHistoricoTemperaturaDiaria(
    campoTemperatura: keyof Pick<ProducaoDiariaRegistro, 'temperatura_t1' | 'temperatura_t2' | 'temperatura_t3'> = 'temperatura_t1'
  ): Promise<HistoricoTemperaturaPonto[]> {
    const registros = await this.obterHistoricoProducao();
    const pontos: HistoricoTemperaturaPonto[] = [];

    for (const row of registros) {
      const dataRegistro = row.data_registro;
      const temperatura = row[campoTemperatura];

      if (!dataRegistro || Number.isNaN(temperatura)) {
        continue;
      }

      pontos.push({
        temperatura,
        horario: this.formatarDataCurta(dataRegistro),
        dataRegistro,
        rotulo: `Media do dia ${this.formatarDataCurta(dataRegistro)}`,
        perigo: temperatura >= 85
      });
    }

    return pontos;
  }

  async obterMediaSemanalTanques(): Promise<HistoricoTemperaturaPonto[]> {
    const registros = await this.obterHistoricoProducao();
    const ultimosSeteDias = registros.slice(-7);
    const campos: Array<keyof Pick<ProducaoDiariaRegistro, 'temperatura_t1' | 'temperatura_t2' | 'temperatura_t3'>> = [
      'temperatura_t1',
      'temperatura_t2',
      'temperatura_t3'
    ];

    return campos.map((campo, index) => {
      const valores = ultimosSeteDias
        .map((row) => row[campo])
        .filter((valor) => !Number.isNaN(valor));
      const media = valores.length
        ? Math.round((valores.reduce((total, valor) => total + valor, 0) / valores.length) * 10) / 10
        : 0;

      return {
        temperatura: media,
        horario: `T${index + 1}`,
        rotulo: `Media semanal do Tanque ${index + 1}`,
        perigo: media >= 85
      };
    });
  }

  async obterOperariosParaTurnos(): Promise<Record<string, unknown>[]> {
    if (!this.supabase || !this.isBrowserRuntime()) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('operarios')
      .select('*')
      .order('turno_inicio', { ascending: true });

    if (error) {
      console.error('Erro ao obter operarios para turnos:', error.message);
      return [];
    }

    return data ?? [];
  }

  async obterStatusTanques(): Promise<TanqueStatus[]> {
    if (!this.supabase || !this.isBrowserRuntime()) {
      return [...tanquesStatusMock];
    }

    const { data, error } = await this.supabase
      .from('status_tanques')
      .select('*')
      .order('codigo', { ascending: true });

    if (error || !data?.length) {
      if (error) {
        console.warn('status_tanques indisponível, usando dados mockados:', error.message);
      }
      return this.mapearProducaoParaTanques(await this.obterHistoricoProducao());
    }

    return data.map((row) => this.normalizarTanque(row));
  }

  async obterHistoricoTemperatura(codigoTanque: string): Promise<HistoricoTemperaturaPonto[]> {
    if (!this.supabase || !this.isBrowserRuntime()) {
      return historicoTemperaturaMock[codigoTanque] ?? [];
    }

    const { data, error } = await this.supabase
      .from('historico_temperatura')
      .select('*')
      .eq('tanque_codigo', codigoTanque)
      .order('registrado_em', { ascending: true })
      .limit(5);

    if (error || !data?.length) {
      return historicoTemperaturaMock[codigoTanque] ?? [];
    }

    return data.map((row) => ({
      temperatura: Number(row.temperatura ?? 0),
      horario: this.formatarHorario(row.registrado_em),
      perigo: Boolean(row.perigo ?? Number(row.temperatura) >= 85)
    }));
  }

  async obterLogOcorrencias(): Promise<LogOcorrencia[]> {
    if (!this.supabase || !this.isBrowserRuntime()) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('log_ocorrencias')
      .select('*')
      .order('horario', { ascending: false })
      .limit(30);

    if (error || !data?.length) {
      return [];
    }

    return data.map((row) => ({
      horario: this.formatarHorarioLog(row.horario),
      mensagem: String(row.mensagem ?? ''),
      tipo: (row.tipo ?? 'info') as LogOcorrencia['tipo']
    }));
  }

  async registrarLogOcorrencia(mensagem: string, tipo: LogOcorrencia['tipo'] = 'info'): Promise<boolean> {
    if (!mensagem.trim()) {
      return false;
    }

    if (!this.supabase || !this.isBrowserRuntime()) {
      return false;
    }

    const { error } = await this.supabase.from('log_ocorrencias').insert([
      {
        mensagem: mensagem.trim(),
        tipo,
        horario: new Date().toISOString()
      }
    ]);

    if (error) {
      console.error('Erro ao registrar log de ocorrência:', error.message);
      return false;
    }

    return true;
  }

  async obterTurnoAtual() {
    if (!this.supabase || !this.isBrowserRuntime()) {
      return null;
    }

    const { data, error } = await this.supabase
      .from('turnos_fabrica')
      .select('*')
      .eq('status', 'em_andamento')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erro ao obter turno atual:', error.message);
      return null;
    }

    return data;
  }

  async sincronizarTurnoAtual(
    operario?: OperarioTurno | null,
    opcoes: { registrarAssuncao?: boolean } = {}
  ): Promise<Record<string, unknown> | null> {
    if (!this.supabase || !this.isBrowserRuntime()) {
      return null;
    }

    const turnoAtivo = await this.obterTurnoAtual();

    if (!operario?.nome?.trim()) {
      return turnoAtivo;
    }

    const turnoCadastro: TurnoCadastro = {
      turno_nome: operario.turno_nome,
      turno_inicio: operario.turno_inicio,
      turno_fim: operario.turno_fim
    };
    const periodo = periodoFromTurnoCadastro(turnoCadastro);
    const dentroDoTurno = turnoCadastroEstaAtivo(turnoCadastro);

    if (!dentroDoTurno) {
      return turnoAtivo;
    }

    if (turnoAtivo) {
      const turnoId = Number(turnoAtivo['id']);
      const turnoAtualNome = String(turnoAtivo['turno'] ?? '');
      const turnoAtualHorario = String(turnoAtivo['horario'] ?? '');
      const mesmoTurno =
        turnoAtualNome === periodo.turno && turnoAtualHorario === periodo.horario;

      if (mesmoTurno) {
        if (
          operario.nome !== turnoAtivo['operario_nome'] &&
          opcoes.registrarAssuncao !== false
        ) {
          const { error: updateError } = await this.supabase
            .from('turnos_fabrica')
            .update({ operario_nome: operario.nome })
            .eq('id', turnoId);

          if (!updateError) {
            await this.adicionarLog(
              turnoId,
              `[SISTEMA] Operador ${operario.nome} assumiu o turno ${periodo.turno}.`,
              'info'
            );
            turnoAtivo['operario_nome'] = operario.nome;
          }
        }

        return turnoAtivo;
      }

      await this.finalizarTurno(turnoId);
    }

    return this.iniciarTurno(operario.nome, periodo);
  }

  private async iniciarTurno(
    operarioNome: string,
    periodo: PeriodoTurno
  ): Promise<Record<string, unknown> | null> {
    if (!this.supabase) {
      return null;
    }

    const { data, error } = await this.supabase
      .from('turnos_fabrica')
      .insert([
        {
          operario_nome: operarioNome,
          turno: periodo.turno,
          horario: periodo.horario,
          status: 'em_andamento'
        }
      ])
      .select()
      .single();

    if (error || !data) {
      console.error('Erro ao iniciar turno:', error?.message);
      return null;
    }

    await this.adicionarLog(
      data['id'] as number,
      `[SISTEMA] Turno ${periodo.turno} iniciado. Operador: ${operarioNome}.`,
      'info'
    );

    return data;
  }

  private async finalizarTurno(turnoId: number): Promise<void> {
    if (!this.supabase || !turnoId) {
      return;
    }

    const { error } = await this.supabase
      .from('turnos_fabrica')
      .update({ status: 'finalizado' })
      .eq('id', turnoId);

    if (error) {
      console.error('Erro ao finalizar turno:', error.message);
    }
  }

  async obterLogsDoTurno(turnoId: string | number): Promise<LogOcorrencia[]> {
    const turnoNumerico = Number(turnoId);
    if (Number.isNaN(turnoNumerico) || !this.supabase || !this.isBrowserRuntime()) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('logs_operacao')
      .select('*')
      .eq('turno_id', turnoNumerico)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao obter logs do turno:', error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      horario: this.formatarHorarioLog(row.created_at ?? row.horario),
      mensagem: String(row.mensagem ?? ''),
      tipo: this.normalizarTipoLog(row.tipo)
    }));
  }

  async adicionarLog(turnoId: string | number, mensagem: string, tipo: LogOcorrencia['tipo'] = 'info'): Promise<boolean> {
    if (!turnoId || !mensagem.trim()) {
      return false;
    }

    const turnoNumerico = Number(turnoId);
    if (Number.isNaN(turnoNumerico)) {
      console.warn('Log de turno ignorado: turno_id inválido.', turnoId);
      return false;
    }

    if (!this.supabase || !this.isBrowserRuntime()) {
      return false;
    }

    const { error } = await this.supabase.from('logs_operacao').insert([
      {
        turno_id: turnoNumerico,
        mensagem: mensagem.trim(),
        tipo,
        created_at: new Date().toISOString()
      }
    ]);

    if (error) {
      console.error('Erro ao adicionar log do turno:', error.message);
      return false;
    }

    return true;
  }

  async obterOcorrenciasRecentes(limite = 20): Promise<OcorrenciaOperador[]> {
    if (!this.supabase || !this.isBrowserRuntime()) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('ocorrencias_operador')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) {
      console.error('Erro ao buscar ocorrências do operador:', error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      descricao: String(row.descricao ?? ''),
      tanques: Array.isArray(row.tanques) ? row.tanques.map(String) : [],
      created_at: String(row.created_at ?? '')
    }));
  }

  calcularResumoSemanal(registros: ProducaoDiariaRegistro[]): ResumoSemanal {
    if (!registros.length) {
      return { oeeMedio: 0, totalAlertas: 0, temperaturaMedia: 0, nivelMedio: 0 };
    }

    const totalAlertas = registros.reduce((acc, row) => acc + row.alertas, 0);
    const oeeMedio = Math.round(
      registros.reduce((acc, row) => acc + this.calcularOee(row), 0) / registros.length
    );
    const temperaturaMedia = Math.round(
      (registros.reduce((acc, row) => acc + row.temperatura, 0) / registros.length) * 10
    ) / 10;
    const nivelMedio = Math.round(
      registros.reduce((acc, row) => acc + row.nivel, 0) / registros.length
    );

    return { oeeMedio, totalAlertas, temperaturaMedia, nivelMedio };
  }

  calcularOee(registro: ProducaoDiariaRegistro): number {
    const temps = [registro.temperatura_t1, registro.temperatura_t2, registro.temperatura_t3];
    const penalidadeTemp = temps.filter((temp) => temp >= 85).length * 5;

    return Math.max(0, Math.min(100, Math.round(100 - registro.alertas * 8 - penalidadeTemp)));
  }

  async enviarOcorrencia(descricao: string, tanques: string[]): Promise<boolean> {
    if (!descricao.trim()) {
      return false;
    }

    if (!this.supabase || !this.isBrowserRuntime()) {
      console.info('Ocorrência registrada localmente:', { descricao, tanques });
      return true;
    }

    const { error } = await this.supabase.from('ocorrencias_operador').insert([
      {
        descricao: descricao.trim(),
        tanques,
        created_at: new Date().toISOString()
      }
    ]);

    if (error) {
      console.error('Erro ao enviar ocorrência:', error.message);
      return false;
    }

    return true;
  }

  async enviarRelatorioEmail(): Promise<boolean> {
    if (!this.supabase || !this.isBrowserRuntime()) {
      console.info('Envio de relatorio semanal ignorado fora do browser/Supabase.');
      return false;
    }

    const dadosCompletos = this.historicoSemanal.length
      ? (this.historicoSemanal as ProducaoDiariaRegistro[])
      : await this.obterHistoricoProducao();
    const dadosSemana = dadosCompletos.slice(-7);
    const ocorrencias = await this.obterOcorrenciasRecentes();
    const resumo = this.calcularResumoSemanal(dadosSemana);

    const { error } = await this.supabase.functions.invoke('send-weekly-pdf', {
      body: {
        email: environment.reportEmail,
        dados: dadosSemana,
        ocorrencias,
        resumo
      }
    });

    if (error) {
      console.error('Erro ao invocar send-weekly-pdf:', error.message);
      return false;
    }

    return true;
  }

  private normalizarProducaoDiaria(row: Record<string, unknown>): ProducaoDiariaRegistro {
    const t1 = Number(row['temperatura_t1'] ?? 0);
    const t2 = Number(row['temperatura_t2'] ?? 0);
    const t3 = Number(row['temperatura_t3'] ?? 0);
    const temperatura = Number(row['temperatura'] ?? (t1 + t2 + t3) / 3);

    return {
      data_registro: String(row['data_registro'] ?? ''),
      temperatura_t1: t1,
      temperatura_t2: t2,
      temperatura_t3: t3,
      temperatura: Math.round(temperatura * 10) / 10,
      nivel: Number(row['nivel'] ?? 0),
      alertas: Number(row['alertas'] ?? 0)
    };
  }

  private gerarProducaoDiariaMock(): ProducaoDiariaRegistro[] {
    const registros: ProducaoDiariaRegistro[] = [];
    const meses = [
      { mes: 4, dias: 30 },
      { mes: 5, dias: 31 },
      { mes: 6, dias: 30 }
    ];

    for (const { mes, dias } of meses) {
      for (let dia = 1; dia <= dias; dia++) {
        const progresso = registros.length / 91;
        const t1 = Math.round(42 + progresso * 18 + (dia % 5));
        const t2 = Math.round(55 + progresso * 25 + (dia % 7));
        const t3 = Math.round(20 + progresso * 8 + (dia % 3));
        const alertas = t2 >= 85 || t1 >= 90 ? 1 + (dia % 3) : dia % 11 === 0 ? 1 : 0;

        registros.push({
          data_registro: `2026-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
          temperatura_t1: t1,
          temperatura_t2: t2,
          temperatura_t3: t3,
          temperatura: Math.round(((t1 + t2 + t3) / 3) * 10) / 10,
          nivel: Math.max(5, Math.min(95, Math.round(70 - progresso * 15 + (dia % 10)))),
          alertas
        });
      }
    }

    this.historicoSemanal = registros;
    return registros;
  }

  private normalizarTanque(row: Record<string, unknown>): TanqueStatus {
    const status = String(row['status'] ?? 'normal') as StatusTanque;

    return {
      codigo: String(row['codigo'] ?? ''),
      linha: String(row['linha'] ?? 'LINHA'),
      nome: String(row['nome'] ?? 'Tanque'),
      temperatura: Number(row['temperatura'] ?? 0),
      nivel: Number(row['nivel'] ?? 0),
      status,
      statusTexto: String(row['status_texto'] ?? this.statusTextoPadrao(status))
    };
  }

  private mapearProducaoParaTanques(registros: ProducaoDiariaRegistro[] | Record<string, unknown>[]): TanqueStatus[] {
    if (!registros.length) {
      return [...tanquesStatusMock];
    }

    const ultimo = registros[registros.length - 1] as ProducaoDiariaRegistro;
    const alertas = ultimo.alertas ?? 0;

    return [
      {
        ...tanquesStatusMock[0],
        temperatura: ultimo.temperatura_t1,
        nivel: ultimo.nivel,
        status: ultimo.temperatura_t1 >= 85 ? 'critico' : 'normal',
        statusTexto: ultimo.temperatura_t1 >= 85 ? 'CRÍTICO — SUPERAQUECIMENTO' : 'OPERANDO — NORMAL'
      },
      {
        ...tanquesStatusMock[1],
        temperatura: ultimo.temperatura_t2,
        nivel: Math.max(20, Math.round(ultimo.nivel * 0.6)),
        status: ultimo.temperatura_t2 >= 85 || alertas > 0 ? 'critico' : 'normal',
        statusTexto: ultimo.temperatura_t2 >= 85 || alertas > 0 ? 'CRÍTICO — SUPERAQUECIMENTO' : 'OPERANDO — NORMAL'
      },
      {
        ...tanquesStatusMock[2],
        temperatura: ultimo.temperatura_t3,
        nivel: Math.max(5, Math.round(ultimo.nivel * 0.1)),
        status: ultimo.temperatura_t3 < 30 ? 'manutencao' : 'normal',
        statusTexto: ultimo.temperatura_t3 < 30 ? 'EM MANUTENÇÃO' : 'OPERANDO — NORMAL'
      }
    ];
  }

  private statusTextoPadrao(status: StatusTanque): string {
    switch (status) {
      case 'critico':
        return 'CRÍTICO — SUPERAQUECIMENTO';
      case 'manutencao':
        return 'EM MANUTENÇÃO';
      default:
        return 'OPERANDO — NORMAL';
    }
  }

  private formatarHorario(valor: unknown): string {
    if (!valor) {
      return '--:--';
    }

    const data = new Date(String(valor));
    if (Number.isNaN(data.getTime())) {
      return String(valor);
    }

    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  private formatarDataCurta(valor: unknown): string {
    if (!valor) {
      return '--/--';
    }

    const data = new Date(String(valor));
    if (Number.isNaN(data.getTime())) {
      return String(valor);
    }

    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  private formatarHorarioLog(valor: unknown): string {
    if (!valor) {
      return '[--:--:--]';
    }

    const bruto = String(valor);
    if (bruto.startsWith('[')) {
      return bruto;
    }

    const data = new Date(bruto);
    if (Number.isNaN(data.getTime())) {
      return `[${bruto}]`;
    }

    const hora = data.toLocaleTimeString('pt-BR');
    return `[${hora}]`;
  }

  private normalizarTipoLog(valor: unknown): LogOcorrencia['tipo'] {
    const tipo = String(valor ?? 'info');

    if (tipo === 'critico') {
      return 'critico';
    }

    if (tipo === 'erro' || tipo === 'alerta' || tipo === 'sucesso' || tipo === 'info') {
      return tipo;
    }

    return 'info';
  }
}
