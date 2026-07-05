export function limparCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export function formatarCpf(cpf: string): string {
  const digits = limparCpf(cpf);
  if (digits.length !== 11) {
    return cpf;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function validarCpf(cpf: string): boolean {
  const digits = limparCpf(cpf);

  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const calcDigito = (base: string, pesoInicial: number): number => {
    let soma = 0;

    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i);
    }

    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const digito1 = calcDigito(digits.slice(0, 9), 10);
  const digito2 = calcDigito(digits.slice(0, 10), 11);

  return digito1 === Number(digits[9]) && digito2 === Number(digits[10]);
}
