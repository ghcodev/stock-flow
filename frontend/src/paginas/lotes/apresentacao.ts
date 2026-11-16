import type { Localizacao, Lote, StatusLote } from "../../api/tipos.ts";
import type { TomDeBadge } from "../../componentes/Badge.tsx";
import { diasAte } from "../../util/datas.ts";

export const ROTULOS_DE_STATUS: Record<StatusLote, string> = { ativo: "Ativo", bloqueado: "Bloqueado", vencido: "Vencido" };

export const TONS_DE_STATUS: Record<StatusLote, TomDeBadge> = { ativo: "sucesso", bloqueado: "alerta", vencido: "perigo" };

export const ROTULOS_DE_ETIQUETA = { qr_code: "QR Code", rfid: "RFID" } as const;

export function rotuloDaLocalizacao(localizacao: Pick<Localizacao, "corredor" | "nivel" | "posicao">): string {
  return `${localizacao.corredor}-${localizacao.nivel}-${localizacao.posicao}`;
}

export type SituacaoDeValidade = { texto: string; tom: "normal" | "alerta" | "perigo" };

export function situacaoDeValidade(lote: Pick<Lote, "data_validade" | "status_lote" | "validade_expirada">, hoje: string): SituacaoDeValidade | null {
  if (lote.data_validade === null) return null;
  const dias = diasAte(lote.data_validade, hoje);
  if (lote.validade_expirada === true) {
    if (dias === null || dias >= 0) return { texto: "validade expirada", tom: "perigo" };
    return { texto: dias === -1 ? "venceu há 1 dia" : `venceu há ${-dias} dias`, tom: "perigo" };
  }
  if (dias === null) return null;
  if (dias < 0 && lote.validade_expirada === undefined) return { texto: dias === -1 ? "venceu há 1 dia" : `venceu há ${-dias} dias`, tom: "perigo" };
  if (dias < 0) return null;
  if (lote.status_lote !== "ativo") return null;
  if (dias === 0) return { texto: "vence hoje", tom: "alerta" };
  if (dias <= 30) return { texto: dias === 1 ? "vence em 1 dia" : `vence em ${dias} dias`, tom: "alerta" };
  return null;
}
