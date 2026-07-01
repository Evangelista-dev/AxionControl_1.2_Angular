/// <reference types="jasmine" />

import { resolverTurnoAtual, operadoresTurnoMock } from './dashboard.mock';

describe('resolverTurnoAtual', () => {
  it('deve identificar o operador do turno da manhã', () => {
    const turno = resolverTurnoAtual(new Date('2026-07-01T08:30:00'));

    expect(turno.nome).toBe('Afonso');
    expect(turno.turno).toBe('Manhã');
  });

  it('deve retornar um operador válido para qualquer horário', () => {
    const turno = resolverTurnoAtual(new Date('2026-07-01T22:45:00'));

    expect(turno.nome).toBeDefined();
    expect(operadoresTurnoMock.some((operador: { nome: string }) => operador.nome === turno.nome)).toBeTrue();
  });
});
