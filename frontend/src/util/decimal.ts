type Partes = { negativo: boolean; inteira: string; fracao: string };

const PADRAO = /^(-)?(\d+)(?:\.(\d+))?$/;

function separar(texto: string): Partes | null {
  const casamento = PADRAO.exec(texto.trim());
  if (!casamento) return null;
  return { negativo: casamento[1] === "-", inteira: casamento[2] ?? "0", fracao: casamento[3] ?? "" };
}

function escalar(partes: Partes, casas: number): bigint {
  const valor = BigInt(partes.inteira + partes.fracao.padEnd(casas, "0"));
  return partes.negativo ? -valor : valor;
}

export function ehDecimalValido(texto: string): boolean {
  return PADRAO.test(texto.trim());
}

export function compararDecimais(a: string, b: string): number {
  const pa = separar(a);
  const pb = separar(b);
  if (pa === null || pb === null) return a.localeCompare(b, "pt-BR");
  const casas = Math.max(pa.fracao.length, pb.fracao.length);
  const va = escalar(pa, casas);
  const vb = escalar(pb, casas);
  return va < vb ? -1 : va > vb ? 1 : 0;
}

export function ehZero(texto: string): boolean {
  const partes = separar(texto);
  return partes !== null && /^0*$/.test(partes.inteira + partes.fracao);
}

const FORMATO_INTEIRO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatarQuantidade(texto: string): string {
  const partes = separar(texto);
  if (partes === null) return texto;
  const inteira = FORMATO_INTEIRO.format(BigInt(partes.inteira));
  const fracao = partes.fracao.replace(/0+$/, "");
  const sinal = partes.negativo && !ehZero(texto) ? "-" : "";
  return fracao === "" ? `${sinal}${inteira}` : `${sinal}${inteira},${fracao}`;
}

export function formatarInteiro(valor: number): string {
  return FORMATO_INTEIRO.format(valor);
}
