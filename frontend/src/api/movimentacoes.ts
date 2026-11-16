import type { Cliente } from "./cliente.ts";
import type { Movimentacao } from "./tipos.ts";
import { normalizarDecimal } from "../util/formularios.ts";

export type CorpoDeSaldo = {
  id_lote: number;
  quantidade: string;
  motivo?: string;
  observacao?: string;
};

export type CorpoDeTransferencia = {
  id_lote: number;
  id_localizacao_destino: number;
  motivo: string;
  observacao?: string;
};

export function corpoDeSaldo(idLote: number, quantidade: string, motivo: string, observacao: string): CorpoDeSaldo {
  const corpo: CorpoDeSaldo = { id_lote: idLote, quantidade: normalizarDecimal(quantidade) };
  if (motivo.trim() !== "") corpo.motivo = motivo.trim();
  if (observacao.trim() !== "") corpo.observacao = observacao.trim();
  return corpo;
}

export function corpoDeTransferencia(idLote: number, idDestino: number, motivo: string, observacao: string): CorpoDeTransferencia {
  const corpo: CorpoDeTransferencia = { id_lote: idLote, id_localizacao_destino: idDestino, motivo: motivo.trim() };
  if (observacao.trim() !== "") corpo.observacao = observacao.trim();
  return corpo;
}

export function registrarEntrada(cliente: Cliente, corpo: CorpoDeSaldo): Promise<Movimentacao> {
  return cliente.post<Movimentacao>("/movimentacoes/entrada", corpo);
}

export function registrarSaida(cliente: Cliente, corpo: CorpoDeSaldo): Promise<Movimentacao> {
  return cliente.post<Movimentacao>("/movimentacoes/saida", corpo);
}

export function registrarTransferencia(cliente: Cliente, corpo: CorpoDeTransferencia): Promise<Movimentacao> {
  return cliente.post<Movimentacao>("/movimentacoes/transferencia", corpo);
}
