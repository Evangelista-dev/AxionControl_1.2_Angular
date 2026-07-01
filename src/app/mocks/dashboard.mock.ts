export interface OperadorTurno {
  nome: string;
  turno: 'Manhã' | 'Tarde' | 'Noite';
  horario: string;
  atividade: string;
  cor: string;
}

export type StatusTanque = 'normal' | 'critico' | 'manutencao';
export type TipoLog = 'info' | 'sucesso' | 'alerta' | 'erro';
export type TipoProjecaoIa = 'predicao' | 'alerta-moderado' | 'alerta-critico';

export interface TanqueStatus {
  codigo: string;
  linha: string;
  nome: string;
  temperatura: number;
  nivel: number;
  status: StatusTanque;
  statusTexto: string;
}

export interface HistoricoTemperaturaPonto {
  temperatura: number;
  horario: string;
  perigo?: boolean;
}

export interface LogOcorrencia {
  horario: string;
  mensagem: string;
  tipo: TipoLog;
}

export interface ProjecaoIa {
  horario: string;
  mensagem: string;
  tipo: TipoProjecaoIa;
}

export interface TanqueMock {
  id: string;
  name: string;
  temp: number;
  nivel: number;
  status: string;
  classStatus: string;
  classCard: string;
  classTemp: string;
  historico: number[];
  classNivel: string;
}

export const tanquesStatusMock: TanqueStatus[] = [
  {
    codigo: 'TK-001',
    linha: 'LINHA A',
    nome: 'Tanque 01 — Misturador',
    temperatura: 85,
    nivel: 70,
    status: 'normal',
    statusTexto: 'OPERANDO — NORMAL'
  },
  {
    codigo: 'TK-002',
    linha: 'LINHA B',
    nome: 'Tanque 02 — Reator Químico',
    temperatura: 115,
    nivel: 40,
    status: 'critico',
    statusTexto: 'CRÍTICO — SUPERAQUECIMENTO'
  },
  {
    codigo: 'TK-003',
    linha: 'LINHA C',
    nome: 'Tanque 03 — Armazenamento',
    temperatura: 22,
    nivel: 5,
    status: 'manutencao',
    statusTexto: 'EM MANUTENÇÃO'
  }
];

export const historicoTemperaturaMock: Record<string, HistoricoTemperaturaPonto[]> = {
  'TK-001': [
    { temperatura: 25, horario: '10:00' },
    { temperatura: 45, horario: '11:00' },
    { temperatura: 46, horario: '12:00' },
    { temperatura: 44, horario: '13:00' },
    { temperatura: 45, horario: '14:00' }
  ],
  'TK-002': [
    { temperatura: 40, horario: '10:00' },
    { temperatura: 60, horario: '11:00' },
    { temperatura: 50, horario: '12:00' },
    { temperatura: 85, horario: '13:00', perigo: true },
    { temperatura: 95, horario: '14:00', perigo: true }
  ],
  'TK-003': [
    { temperatura: 60, horario: '10:00' },
    { temperatura: 40, horario: '11:00' },
    { temperatura: 25, horario: '12:00' },
    { temperatura: 22, horario: '13:00' },
    { temperatura: 22, horario: '14:00' }
  ]
};

export const logOcorrenciasMock: LogOcorrencia[] = [
  { horario: '[08:00:12]', mensagem: '[SISTEMA] Login do Operador: Alisson Teixeira (Turno A).', tipo: 'info' },
  { horario: '[09:15:00]', mensagem: '[TANQUE 03] Ciclo de lavagem concluído com sucesso.', tipo: 'sucesso' },
  { horario: '[09:20:33]', mensagem: '[TANQUE 03] Válvulas bloqueadas fisicamente para manutenção.', tipo: 'info' },
  { horario: '[10:05:10]', mensagem: '[TANQUE 01] Iniciando ciclo de mistura nominal.', tipo: 'info' },
  { horario: '[11:00:05]', mensagem: '[TANQUE 01] Temperatura ideal (45°C) atingida e estabilizada.', tipo: 'sucesso' },
  { horario: '[13:45:22]', mensagem: '[TANQUE 02] Aviso: Taxa de aquecimento acima do padrão.', tipo: 'alerta' },
  { horario: '[14:10:00]', mensagem: '[TANQUE 02] CRÍTICO: Temperatura em 98°C. Limite de segurança excedido!', tipo: 'erro' }
];

export const projecoesIaMock: ProjecaoIa[] = [
  {
    horario: '[Em 15 min]',
    mensagem: '[OTIMIZAÇÃO] Redução de 12% no consumo de energia prevista ao sincronizar o resfriamento dos Tanques 01 e 03.',
    tipo: 'predicao'
  },
  {
    horario: '[Em 40 min]',
    mensagem: '[QUALIDADE] Lote atual de mistura atingirá a viscosidade ideal (99.8% de precisão) antes do tempo estimado.',
    tipo: 'predicao'
  },
  {
    horario: '[Em 72 horas]',
    mensagem: '[MANUTENÇÃO] Vibração anômala detectada no Motor Principal da Linha B. Falha projetada em 3 dias. Recomendação: Agendar revisão.',
    tipo: 'alerta-moderado'
  },
  {
    horario: '[15:30:00]',
    mensagem: '[PRODUÇÃO] Probabilidade de 85% de gargalo no setor de embalagens devido ao aumento do fluxo da Linha A.',
    tipo: 'predicao'
  },
  {
    horario: '[Crítico]',
    mensagem: '[SEGURANÇA] Tendência de superaquecimento (105°C) projetada para a Válvula de Pressão 04 em exatos 18 minutos. Ação manual ou correção automática exigida imediatamente.',
    tipo: 'alerta-critico'
  },
  {
    horario: '[Amanhã, 08:00]',
    mensagem: '[AMBIENTE] Queda brusca de temperatura externa prevista. Ajustando parâmetros de pré-aquecimento das caldeiras automaticamente.',
    tipo: 'predicao'
  }
];

export const operadoresTurnoMock: OperadorTurno[] = [
  {
    nome: 'Afonso',
    turno: 'Manhã',
    horario: '06:00 às 14:00',
    atividade: 'Monitoramento térmico e manutenção preventiva',
    cor: 'status-ligado'
  },
  {
    nome: 'Breno',
    turno: 'Tarde',
    horario: '14:00 às 22:00',
    atividade: 'Acompanhamento de níveis e alertas',
    cor: 'status-ligado'
  },
  {
    nome: 'João Pedro',
    turno: 'Noite',
    horario: '22:00 às 06:00',
    atividade: 'Supervisão noturna e registro de ocorrências',
    cor: 'status-manutencao'
  }
];

export function resolverTurnoAtual(data: Date): OperadorTurno {
  const hora = data.getHours();

  if (hora >= 6 && hora < 14) {
    return operadoresTurnoMock[0];
  }

  if (hora >= 14 && hora < 22) {
    return operadoresTurnoMock[1];
  }

  return operadoresTurnoMock[2];
}

export function obterOperadorPorNome(nome: string): OperadorTurno | undefined {
  return operadoresTurnoMock.find((operador) => operador.nome.toLowerCase() === nome.toLowerCase());
}

export function mapearStatusParaClasses(status: StatusTanque) {
  switch (status) {
    case 'critico':
      return {
        classCard: 'critico',
        classTemp: 'temp-critica',
        classStatus: 'status-erro',
        barraClasse: 'barra-nivel-critica'
      };
    case 'manutencao':
      return {
        classCard: 'manutencao',
        classTemp: 'temp-ambiente',
        classStatus: 'status-manutencao',
        barraClasse: 'barra-nivel-manutencao'
      };
    default:
      return {
        classCard: '',
        classTemp: 'temp-normal',
        classStatus: 'status-ligado',
        barraClasse: 'barra-nivel-normal'
      };
  }
}

export function calcularAlturaBarra(temperatura: number, maximo = 120): number {
  return Math.max(4, Math.round((temperatura / maximo) * 100));
}
