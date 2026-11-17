import type { LotesPorSituacao } from "../api/tipos.ts";

export type ChaveDeFatia = "ativo" | "vencendo" | "bloqueado" | "vencido";

export type FatiaDaRosca = {
  chave: ChaveDeFatia;
  rotulo: string;
  valor: number;
  fracao: number;
  comprimento: number;
  deslocamento: number;
};

const ROTULOS: Record<ChaveDeFatia, string> = {
  ativo: "Ativos",
  vencendo: "Vencendo em 30 dias",
  bloqueado: "Bloqueados",
  vencido: "Vencidos",
};

export function fatiasDaRosca(situacao: LotesPorSituacao, circunferencia: number): { fatias: FatiaDaRosca[]; total: number } {
  const valores: Record<ChaveDeFatia, number> = {
    ativo: Math.max(0, situacao.ativo - situacao.vencendo),
    vencendo: Math.min(situacao.vencendo, situacao.ativo),
    bloqueado: situacao.bloqueado,
    vencido: situacao.vencido,
  };
  const total = valores.ativo + valores.vencendo + valores.bloqueado + valores.vencido;
  let acumulado = 0;
  const fatias: FatiaDaRosca[] = [];
  for (const chave of ["ativo", "vencendo", "bloqueado", "vencido"] as const) {
    const valor = valores[chave];
    const fracao = total === 0 ? 0 : valor / total;
    fatias.push({ chave, rotulo: ROTULOS[chave], valor, fracao, comprimento: fracao * circunferencia, deslocamento: acumulado * circunferencia });
    acumulado += fracao;
  }
  return { fatias, total };
}

export function larguraRelativa(valor: number, maximo: number): number {
  if (!(maximo > 0) || !(valor > 0)) return 0;
  return Math.min(1, valor / maximo);
}

export function pontosDaLinha(valores: readonly number[], largura: number, altura: number, maximo: number): string {
  if (valores.length === 0) return "";
  const passo = valores.length === 1 ? 0 : largura / (valores.length - 1);
  const teto = maximo > 0 ? maximo : 1;
  return valores.map((valor, indice) => `${(indice * passo).toFixed(1)},${(altura - (Math.max(0, valor) / teto) * altura).toFixed(1)}`).join(" ");
}

export function paraGeometria(texto: string): number {
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

export function cortarTexto(texto: string, limite: number): string {
  return texto.length <= limite ? texto : `${texto.slice(0, Math.max(1, limite - 1))}…`;
}
