export function suavizacaoDeSaida(progresso: number): number {
  const p = Math.max(0, Math.min(1, progresso));
  return 1 - (1 - p) ** 3;
}

export function valorDoContador(de: number, para: number, progresso: number): number {
  return Math.round(de + (para - de) * suavizacaoDeSaida(progresso));
}
