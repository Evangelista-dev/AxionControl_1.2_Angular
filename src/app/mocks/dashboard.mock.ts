export interface PeriodoTurno {
  turno: string;
  horario: string;
  inicio: number;
  fim: number;
}

export const PERIODOS_TURNO: PeriodoTurno[] = [
  { turno: 'Manhã', horario: '06:00 às 14:00', inicio: 6, fim: 14 },
  { turno: 'Tarde', horario: '14:00 às 22:00', inicio: 14, fim: 22 },
  { turno: 'Noite', horario: '22:00 às 06:00', inicio: 22, fim: 6 }
];

export function identificarPeriodoTurno(data = new Date()): PeriodoTurno {
  const hora = data.getHours();

  for (const periodo of PERIODOS_TURNO) {
    if (periodo.inicio < periodo.fim) {
      if (hora >= periodo.inicio && hora < periodo.fim) {
        return periodo;
      }
    } else if (hora >= periodo.inicio || hora < periodo.fim) {
      return periodo;
    }
  }

  return PERIODOS_TURNO[0];
}

export function turnoEstaAtivo(horaAtual: number, inicio: number, fim: number): boolean {
  if (inicio < fim) {
    return horaAtual >= inicio && horaAtual < fim;
  }
  return horaAtual >= inicio || horaAtual < fim;
}

export type StatusTanque = 'normal' | 'critico' | 'manutencao';
export type TipoLog = 'info' | 'sucesso' | 'alerta' | 'erro' | 'critico';
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
  dataRegistro?: string;
  rotulo?: string;
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
