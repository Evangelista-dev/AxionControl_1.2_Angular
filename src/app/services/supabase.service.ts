import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { operariosMockData, OperarioMock } from '../mocks/operarios.mock';
import {
  HistoricoTemperaturaPonto,
  LogOcorrencia,
  ProjecaoIa,
  StatusTanque,
  TanqueStatus,
  calcularAlturaBarra,
  historicoTemperaturaMock,
  logOcorrenciasMock,
  projecoesIaMock,
  tanquesStatusMock
} from '../mocks/dashboard.mock';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient | null = null;
  private useMockData = true;
  private mockOperarios: OperarioMock[] = [...operariosMockData];

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
      return this.mockOperarios;
    }
    return data;
  }

  async cadastrarOperario(id_gerado: string, nome: string, cpf: string) {
    if (this.useMockData || !this.supabase) {
      this.mockOperarios.unshift({
        id_gerado,
        nome,
        cpf,
        created_at: new Date().toISOString()
      });
      return true;
    }

    const { error } = await this.supabase.from('operarios').insert([
      {
        id_gerado,
        nome,
        cpf,
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

    const { data, error } = await this.supabase
      .from('operarios')
      .select('*')
      .eq('id_gerado', id_gerado)
      .single();

    if (error || !data) {
      console.error('Erro no login/ID não encontrado:', error?.message);
      return null;
    }
    return data;
  }

  async obterHistoricoProducao() {
    if (!this.supabase || !this.isBrowserRuntime()) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('producao_diaria')
      .select('*')
      .order('data_registro', { ascending: true });

    if (error) {
      console.error('Erro ao buscar histórico industrial:', error.message);
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
      return [...logOcorrenciasMock];
    }

    const { data, error } = await this.supabase
      .from('log_ocorrencias')
      .select('*')
      .order('horario', { ascending: false })
      .limit(20);

    if (error || !data?.length) {
      return [...logOcorrenciasMock];
    }

    return data
      .slice()
      .reverse()
      .map((row) => ({
        horario: this.formatarHorarioLog(row.horario),
        mensagem: String(row.mensagem ?? ''),
        tipo: (row.tipo ?? 'info') as LogOcorrencia['tipo']
      }));
  }

  async obterProjecoesIa(): Promise<ProjecaoIa[]> {
    if (!this.supabase || !this.isBrowserRuntime()) {
      return [...projecoesIaMock];
    }

    const { data, error } = await this.supabase
      .from('projecoes_ia')
      .select('*')
      .order('id', { ascending: true });

    if (error || !data?.length) {
      return [...projecoesIaMock];
    }

    return data.map((row) => ({
      horario: String(row.horario ?? ''),
      mensagem: String(row.mensagem ?? ''),
      tipo: (row.tipo ?? 'predicao') as ProjecaoIa['tipo']
    }));
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

  private mapearProducaoParaTanques(registros: Record<string, unknown>[]): TanqueStatus[] {
    if (!registros.length) {
      return [...tanquesStatusMock];
    }

    const ultimo = registros[registros.length - 1];
    const tempBase = Number(ultimo['temperatura'] ?? 45);
    const nivelBase = Number(ultimo['nivel'] ?? 70);
    const alertas = Number(ultimo['alertas'] ?? 0);

    return [
      {
        ...tanquesStatusMock[0],
        temperatura: tempBase,
        nivel: nivelBase,
        status: 'normal',
        statusTexto: 'OPERANDO — NORMAL'
      },
      {
        ...tanquesStatusMock[1],
        temperatura: alertas > 0 ? Math.max(tempBase + 50, 95) : 60,
        nivel: Math.max(20, Math.round(nivelBase * 0.6)),
        status: alertas > 0 ? 'critico' : 'normal',
        statusTexto: alertas > 0 ? 'CRÍTICO — SUPERAQUECIMENTO' : 'OPERANDO — NORMAL'
      },
      {
        ...tanquesStatusMock[2],
        temperatura: Math.max(18, Math.round(tempBase * 0.5)),
        nivel: Math.max(5, Math.round(nivelBase * 0.1)),
        status: 'manutencao',
        statusTexto: 'EM MANUTENÇÃO'
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
}
