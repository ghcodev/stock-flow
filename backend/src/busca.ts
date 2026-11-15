export function literalParaLike(texto: string): string {
  return texto.replace(/[\\%_]/g, "\\$&");
}
