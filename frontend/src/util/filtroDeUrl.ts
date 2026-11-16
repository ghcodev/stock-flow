import type { Localizacao } from "../api/tipos.ts";
import { idValido } from "./formularios.ts";

export function idDaLocalizacaoNaUrl(busca: string): string | null {
  const id = new URLSearchParams(busca).get("id_localizacao");
  return id !== null && idValido(id) ? id : null;
}

export function rotuloDaLocalizacaoDaUrl(id: string, localizacao: Pick<Localizacao, "id_localizacao" | "corredor" | "nivel" | "posicao"> | null): string {
  if (localizacao === null || String(localizacao.id_localizacao) !== id) return `Localização ${id}`;
  return `${localizacao.corredor}-${localizacao.nivel}-${localizacao.posicao}`;
}

export function ligacaoParaLotesDaLocalizacao(idLocalizacao: number): string {
  return `/lotes?id_localizacao=${encodeURIComponent(String(idLocalizacao))}`;
}
