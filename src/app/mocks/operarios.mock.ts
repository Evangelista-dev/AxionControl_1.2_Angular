export interface OperarioMock {
  id_gerado: string;
  nome: string;
  cpf: string;
  turno_nome: string;
  turno_inicio: string;
  turno_fim: string;
  created_at: string;
}

/** Lista vazia — operadores vêm exclusivamente do Supabase. */
export const operariosMockData: OperarioMock[] = [];
