/// <reference types="jasmine" />

import { identificarPeriodoTurno, PERIODOS_TURNO, turnoEstaAtivo } from './dashboard.mock';

describe('identificarPeriodoTurno', () => {
  it('deve identificar o turno da manhã', () => {
    const periodo = identificarPeriodoTurno(new Date('2026-07-01T08:30:00'));

    expect(periodo.turno).toBe('Manhã');
    expect(periodo.horario).toBe('06:00 às 14:00');
  });

  it('deve identificar o turno da tarde', () => {
    const periodo = identificarPeriodoTurno(new Date('2026-07-01T16:00:00'));

    expect(periodo.turno).toBe('Tarde');
  });

  it('deve identificar o turno da noite', () => {
    const periodo = identificarPeriodoTurno(new Date('2026-07-01T23:00:00'));

    expect(periodo.turno).toBe('Noite');
  });

  it('deve cobrir todos os períodos definidos', () => {
    expect(PERIODOS_TURNO.length).toBe(3);
    expect(turnoEstaAtivo(8, 6, 14)).toBeTrue();
    expect(turnoEstaAtivo(23, 22, 6)).toBeTrue();
  });
});
