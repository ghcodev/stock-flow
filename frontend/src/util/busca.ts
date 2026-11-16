export function termosDeBusca(texto: string): string[] {
  return texto
    .split(/[\s\-/]+/)
    .map((termo) => termo.trim())
    .filter((termo) => termo !== "");
}

export function termoMaisSeletivo(termos: readonly string[]): string {
  return termos.reduce((melhor, termo) => (termo.length > melhor.length ? termo : melhor), "");
}

export function casaComTodosOsTermos(rotulo: string, termos: readonly string[]): boolean {
  const alvo = rotulo.toLocaleLowerCase("pt-BR");
  return termos.every((termo) => alvo.includes(termo.toLocaleLowerCase("pt-BR")));
}
