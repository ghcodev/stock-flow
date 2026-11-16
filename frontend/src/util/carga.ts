export type EstadoDaCarga<T> = {
  dados: { consulta: number; valor: T } | null;
  erro: { consulta: number; mensagem: string } | null;
};

export function estadoInicial<T>(): EstadoDaCarga<T> {
  return { dados: null, erro: null };
}

export function aplicarSucesso<T>(estado: EstadoDaCarga<T>, consulta: number, valor: T): EstadoDaCarga<T> {
  const erro = estado.erro !== null && estado.erro.consulta === consulta ? null : estado.erro;
  return { dados: { consulta, valor }, erro };
}

export function aplicarFalha<T>(estado: EstadoDaCarga<T>, consulta: number, mensagem: string): EstadoDaCarga<T> {
  return { dados: estado.dados, erro: { consulta, mensagem } };
}

export function visivel<T>(estado: EstadoDaCarga<T>, consultaAtual: number): { dados: T | null; erro: string | null } {
  return {
    dados: estado.dados !== null && estado.dados.consulta === consultaAtual ? estado.dados.valor : null,
    erro: estado.erro !== null && estado.erro.consulta === consultaAtual ? estado.erro.mensagem : null,
  };
}

export function mesmasDependencias(a: readonly unknown[] | null, b: readonly unknown[]): boolean {
  return a !== null && a.length === b.length && a.every((valor, indice) => Object.is(valor, b[indice]));
}
