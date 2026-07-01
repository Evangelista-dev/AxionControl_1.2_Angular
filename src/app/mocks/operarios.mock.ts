export interface OperarioMock {
  id_gerado: string;
  nome: string;
  cpf: string;
  created_at: string;
}

export const operariosMockData: OperarioMock[] = [
  {
    id_gerado: 'AX101',
    nome: 'Ana Paula Silva',
    cpf: '123.456.789-00',
    created_at: '2026-06-01T08:30:00.000Z'
  },
  {
    id_gerado: 'BR202',
    nome: 'Carlos Mendes',
    cpf: '987.654.321-11',
    created_at: '2026-06-02T09:15:00.000Z'
  },
  {
    id_gerado: 'CN303',
    nome: 'Juliana Rocha',
    cpf: '456.123.789-22',
    created_at: '2026-06-03T10:45:00.000Z'
  },
  {
    id_gerado: 'DE404',
    nome: 'Rafael Torres',
    cpf: '321.654.987-33',
    created_at: '2026-06-04T11:20:00.000Z'
  }
];
