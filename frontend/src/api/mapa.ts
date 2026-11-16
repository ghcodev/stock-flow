import type { Cliente } from "./cliente.ts";
import type { Pagina, StatusLote } from "./tipos.ts";

export type LoteNoMapa = {
  id_lote: number;
  numero_lote: string;
  status_lote: StatusLote;
  quantidade: string;
  unidade_medida: string;
  produto: string;
};

export type PosicaoDoMapa = {
  id_localizacao: number;
  corredor: string;
  nivel: string;
  posicao: string;
  capacidade: string | null;
  descricao: string | null;
  total_lotes: number;
  lotes: LoteNoMapa[];
};

export function listarMapa(cliente: Cliente, corredor: string, pagina: number, limite: number, sinal?: AbortSignal): Promise<Pagina<PosicaoDoMapa>> {
  return cliente.get<Pagina<PosicaoDoMapa>>("/mapa", { corredor: corredor === "" ? undefined : corredor, pagina, limite }, sinal);
}
