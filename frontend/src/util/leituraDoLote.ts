import type { Lote } from "../api/tipos.ts";

export type EstadoDaLeitura = "valida" | "pendente" | "falhou";

export type LeituraDoLote = { estado: EstadoDaLeitura; lote: Lote } | null;

export type AcaoDeLeitura =
  | { tipo: "escolher"; lote: Lote }
  | { tipo: "reler"; id: number }
  | { tipo: "recebida"; lote: Lote }
  | { tipo: "falhou"; id: number }
  | { tipo: "limpar" };

export function reduzirLeitura(leitura: LeituraDoLote, acao: AcaoDeLeitura): LeituraDoLote {
  switch (acao.tipo) {
    case "escolher":
      return { estado: "valida", lote: acao.lote };
    case "limpar":
      return null;
    case "reler":
      return leitura !== null && leitura.lote.id_lote === acao.id ? { estado: "pendente", lote: leitura.lote } : leitura;
    case "recebida":
      return leitura !== null && leitura.estado === "pendente" && leitura.lote.id_lote === acao.lote.id_lote ? { estado: "valida", lote: acao.lote } : leitura;
    case "falhou":
      return leitura !== null && leitura.estado === "pendente" && leitura.lote.id_lote === acao.id ? { estado: "falhou", lote: leitura.lote } : leitura;
  }
}

export function podeEscreverNoLote(leitura: LeituraDoLote): boolean {
  return leitura !== null && leitura.estado === "valida";
}
