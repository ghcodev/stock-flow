export type Inclinacao = { x: number; y: number };

export const SEM_INCLINACAO: Inclinacao = { x: 0, y: 0 };

function limitar(valor: number): number {
  return Math.max(-1, Math.min(1, valor));
}

export function inclinacaoDoPonteiro(x: number, y: number, largura: number, altura: number): Inclinacao {
  if (!(largura > 0) || !(altura > 0)) return SEM_INCLINACAO;
  return { x: limitar((x / largura) * 2 - 1), y: limitar((y / altura) * 2 - 1) };
}

export function inclinacaoDoAparelho(beta: number | null, gamma: number | null): Inclinacao {
  if (beta === null || gamma === null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return SEM_INCLINACAO;
  return { x: limitar(gamma / 35), y: limitar((beta - 45) / 35) };
}

export function suavizar(atual: Inclinacao, alvo: Inclinacao, fator = 0.09): Inclinacao {
  return { x: atual.x + (alvo.x - atual.x) * fator, y: atual.y + (alvo.y - atual.y) * fator };
}

export function estabilizou(atual: Inclinacao, alvo: Inclinacao, margem = 0.002): boolean {
  return Math.abs(atual.x - alvo.x) < margem && Math.abs(atual.y - alvo.y) < margem;
}
