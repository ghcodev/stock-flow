export function janelaDePaginas(pagina: number, ultima: number): number[] {
  const inicio = Math.max(1, Math.min(pagina - 2, ultima - 4));
  const fim = Math.min(ultima, inicio + 4);
  return Array.from({ length: fim - inicio + 1 }, (_, indice) => inicio + indice);
}

export function ultimaPagina(total: number, limite: number): number {
  return Math.max(1, Math.ceil(total / limite));
}

export function limitesDaPagina(pagina: number, limite: number, total: number): { primeiro: number; ultimo: number } {
  return { primeiro: total === 0 ? 0 : (pagina - 1) * limite + 1, ultimo: Math.min(total, pagina * limite) };
}

export function paginaCorrigida(pagina: number, total: number, limite: number): number {
  return Math.min(Math.max(1, pagina), ultimaPagina(total, limite));
}
