import type { PontoDoGrafico, TipoMovimentacao } from "../api/tipos.ts";

export const TIPOS_DO_GRAFICO: readonly TipoMovimentacao[] = ["entrada", "saida", "transferencia", "ajuste", "inventario"];

export const ROTULOS_DOS_TIPOS: Record<TipoMovimentacao, string> = {
  entrada: "Entrada",
  saida: "Saída",
  transferencia: "Transferência",
  ajuste: "Ajuste",
  inventario: "Inventário",
};

export type DiaDoGrafico = {
  dia: string;
  valores: Record<TipoMovimentacao, number>;
  total: number;
};

const PADRAO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function adicionarDias(dia: string, quantidade: number): string {
  const partes = PADRAO_DIA.exec(dia);
  if (!partes) return dia;
  const data = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]) + quantidade));
  return data.toISOString().slice(0, 10);
}

function zerado(): Record<TipoMovimentacao, number> {
  return { entrada: 0, saida: 0, transferencia: 0, ajuste: 0, inventario: 0 };
}

export function montarDias(pontos: readonly PontoDoGrafico[], fim: string, quantidade = 30): DiaDoGrafico[] {
  const ultimo = pontos.reduce((maior, ponto) => (ponto.dia > maior ? ponto.dia : maior), fim);
  const dias: DiaDoGrafico[] = Array.from({ length: quantidade }, (_, indice) => ({
    dia: adicionarDias(ultimo, indice - (quantidade - 1)),
    valores: zerado(),
    total: 0,
  }));
  const porDia = new Map(dias.map((d) => [d.dia, d]));
  for (const ponto of pontos) {
    const dia = porDia.get(ponto.dia);
    if (!dia || !TIPOS_DO_GRAFICO.includes(ponto.tipo)) continue;
    if (!Number.isInteger(ponto.total) || ponto.total < 0) continue;
    dia.valores[ponto.tipo] += ponto.total;
    dia.total += ponto.total;
  }
  return dias;
}

export function maximoDaEscala(maximo: number): number {
  if (maximo <= 5) return 5;
  const potencia = 10 ** Math.floor(Math.log10(maximo));
  for (const passo of [1, 2, 5, 10]) {
    if (maximo <= passo * potencia) return passo * potencia;
  }
  return 10 * potencia;
}

export function marcasDoEixo(escala: number): number[] {
  const divisoes = escala % 4 === 0 ? 4 : escala % 5 === 0 ? 5 : escala % 2 === 0 ? 2 : 1;
  return Array.from({ length: divisoes + 1 }, (_, indice) => (escala / divisoes) * indice);
}

export type ResumoDoGrafico = {
  total: number;
  maximoDiario: number;
  diaDePico: string | null;
};

export function resumirDias(dias: readonly DiaDoGrafico[]): ResumoDoGrafico {
  let total = 0;
  let maximoDiario = 0;
  let diaDePico: string | null = null;
  for (const dia of dias) {
    total += dia.total;
    if (dia.total > maximoDiario) {
      maximoDiario = dia.total;
      diaDePico = dia.dia;
    }
  }
  return { total, maximoDiario, diaDePico };
}
