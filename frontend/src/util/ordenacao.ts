export type Direcao = "asc" | "desc";

export type Ordenacao = { coluna: string; direcao: Direcao };

export function proximaOrdenacao(atual: Ordenacao | null, coluna: string): Ordenacao | null {
  if (atual === null || atual.coluna !== coluna) return { coluna, direcao: "asc" };
  return atual.direcao === "asc" ? { coluna, direcao: "desc" } : null;
}

export function ordenarLinhas<T>(linhas: readonly T[], comparar: ((a: T, b: T) => number) | null, direcao: Direcao): T[] {
  if (comparar === null) return [...linhas];
  const sinal = direcao === "asc" ? 1 : -1;
  return linhas
    .map((linha, indice) => ({ linha, indice }))
    .sort((x, y) => sinal * comparar(x.linha, y.linha) || x.indice - y.indice)
    .map((item) => item.linha);
}

export function compararTexto(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true });
}
