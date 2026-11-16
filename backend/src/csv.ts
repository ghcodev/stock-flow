const SEPARADOR = ";";
const QUEBRA = "\r\n";
const BOM = "\uFEFF";
const INICIOS_DE_FORMULA = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function celulaCsv(valor: string): string {
  const protegido = valor.length > 0 && INICIOS_DE_FORMULA.has(valor[0] ?? "") ? `'${valor}` : valor;
  const precisaAspas = /[";\r\n]/.test(protegido);
  return precisaAspas ? `"${protegido.replaceAll('"', '""')}"` : protegido;
}

export function montarCsv(cabecalho: string[], linhas: string[][]): string {
  const todas = [cabecalho, ...linhas].map((linha) => linha.map(celulaCsv).join(SEPARADOR));
  return BOM + todas.join(QUEBRA) + QUEBRA;
}
