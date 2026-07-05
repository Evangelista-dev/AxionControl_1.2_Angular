export interface TurnoCadastro {
  turno_nome: string;
  turno_inicio: string;
  turno_fim: string;
}

export interface TurnoPreset extends TurnoCadastro {}

export const TURNOS_PRESET: TurnoPreset[] = [
  { turno_nome: 'Manhã', turno_inicio: '06:00', turno_fim: '14:00' },
  { turno_nome: 'Tarde', turno_inicio: '14:00', turno_fim: '22:00' },
  { turno_nome: 'Noite', turno_inicio: '22:00', turno_fim: '06:00' }
];

export function parseHoraTurno(valor: string): number {
  const partes = String(valor ?? '0:0').split(':');
  return Number(partes[0] ?? 0);
}

export function formatarHorarioTurno(inicio: string, fim: string): string {
  return `${inicio} às ${fim}`;
}

export function turnoEstaAtivo(horaAtual: number, inicio: number, fim: number): boolean {
  if (inicio < fim) {
    return horaAtual >= inicio && horaAtual < fim;
  }
  return horaAtual >= inicio || horaAtual < fim;
}

export function turnoCadastroEstaAtivo(turno: TurnoCadastro, data = new Date()): boolean {
  const hora = data.getHours();
  const inicio = parseHoraTurno(turno.turno_inicio);
  const fim = parseHoraTurno(turno.turno_fim);
  return turnoEstaAtivo(hora, inicio, fim);
}

export function normalizarTurnoOperario(row: Record<string, unknown>): TurnoCadastro {
  return {
    turno_nome: String(row['turno_nome'] ?? 'Turno'),
    turno_inicio: String(row['turno_inicio'] ?? '06:00').slice(0, 5),
    turno_fim: String(row['turno_fim'] ?? '14:00').slice(0, 5)
  };
}

export function periodoFromTurnoCadastro(turno: TurnoCadastro) {
  return {
    turno: turno.turno_nome,
    horario: formatarHorarioTurno(turno.turno_inicio, turno.turno_fim),
    inicio: parseHoraTurno(turno.turno_inicio),
    fim: parseHoraTurno(turno.turno_fim)
  };
}
