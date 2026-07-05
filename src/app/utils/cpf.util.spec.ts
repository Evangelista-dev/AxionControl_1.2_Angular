import { validarCpf, formatarCpf, limparCpf } from './cpf.util';

describe('cpf.util', () => {
  it('deve validar um CPF correto', () => {
    expect(validarCpf('529.982.247-25')).toBeTrue();
  });

  it('deve rejeitar CPF com digitos repetidos', () => {
    expect(validarCpf('111.111.111-11')).toBeFalse();
  });

  it('deve formatar CPF com 11 digitos', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });

  it('deve limpar caracteres nao numericos', () => {
    expect(limparCpf('529.982.247-25')).toBe('52998224725');
  });
});
