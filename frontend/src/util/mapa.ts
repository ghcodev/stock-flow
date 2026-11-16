import type { PosicaoDoMapa } from "../api/mapa.ts";
import { contemNul } from "./formularios.ts";

export const MAXIMO_DE_LOTES_POR_POSICAO = 50;

export type NivelAgrupado = { nivel: string; posicoes: PosicaoDoMapa[] };
export type CorredorAgrupado = { corredor: string; niveis: NivelAgrupado[] };

export function agruparPorCorredorENivel(posicoes: readonly PosicaoDoMapa[]): CorredorAgrupado[] {
  const corredores: CorredorAgrupado[] = [];
  for (const posicao of posicoes) {
    let corredor = corredores.find((c) => c.corredor === posicao.corredor);
    if (corredor === undefined) {
      corredor = { corredor: posicao.corredor, niveis: [] };
      corredores.push(corredor);
    }
    let nivel = corredor.niveis.find((n) => n.nivel === posicao.nivel);
    if (nivel === undefined) {
      nivel = { nivel: posicao.nivel, posicoes: [] };
      corredor.niveis.push(nivel);
    }
    nivel.posicoes.push(posicao);
  }
  return corredores;
}

export function haMaisLotesQueOsListados(posicao: Pick<PosicaoDoMapa, "total_lotes" | "lotes">): boolean {
  return posicao.total_lotes > posicao.lotes.length;
}

export function validarCorredor(texto: string): string | null {
  const limpo = texto.trim();
  if (limpo === "") return null;
  if (contemNul(limpo)) return "O corredor contém caractere inválido.";
  return limpo.length > 10 ? "O corredor deve ter até 10 caracteres." : null;
}

export function textoDaCapacidade(capacidade: string | null): string | null {
  return capacidade === null || capacidade.trim() === "" ? null : capacidade;
}
