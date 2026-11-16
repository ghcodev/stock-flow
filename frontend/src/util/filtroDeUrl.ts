import { idValido } from "./formularios.ts";

export type LocalizacaoDaUrl = { id: string; rotulo: string };

const ROTULO_SEGURO = /^[\p{L}\p{N} ._/-]{1,40}$/u;

export function localizacaoDaUrl(busca: string): LocalizacaoDaUrl | null {
  const parametros = new URLSearchParams(busca);
  const id = parametros.get("id_localizacao");
  if (id === null || !idValido(id)) return null;
  const rotulo = parametros.get("rotulo");
  return { id, rotulo: rotulo !== null && ROTULO_SEGURO.test(rotulo) ? rotulo : `Localização ${id}` };
}

export function ligacaoParaLotesDaLocalizacao(idLocalizacao: number, rotulo: string): string {
  return `/lotes?id_localizacao=${encodeURIComponent(String(idLocalizacao))}&rotulo=${encodeURIComponent(rotulo)}`;
}
