import { segmento, type Cliente } from "./cliente.ts";
import type { Etiqueta, Localizacao, Lote, Pagina, StatusLote, TipoEtiqueta } from "./tipos.ts";
import { normalizarDecimal, type ValoresDeLote } from "../util/formularios.ts";

export type FiltroDeLotes = {
  id_produto?: number | undefined;
  id_localizacao?: number | undefined;
  status?: StatusLote | undefined;
  numero_lote?: string | undefined;
  codigo_etiqueta?: string | undefined;
  pagina?: number | undefined;
  limite?: number | undefined;
};

export type CorpoDeLote = {
  numero_lote: string;
  id_produto: number;
  id_localizacao: number;
  quantidade?: string;
  data_fabricacao?: string;
  data_validade?: string;
  etiqueta?: { tipo: TipoEtiqueta; codigo: string };
};

export function corpoDeLote(valores: ValoresDeLote): CorpoDeLote {
  const corpo: CorpoDeLote = {
    numero_lote: valores.numero_lote.trim(),
    id_produto: Number(valores.id_produto),
    id_localizacao: Number(valores.id_localizacao),
  };
  if (valores.quantidade.trim() !== "") corpo.quantidade = normalizarDecimal(valores.quantidade);
  if (valores.data_fabricacao !== "") corpo.data_fabricacao = valores.data_fabricacao;
  if (valores.data_validade !== "") corpo.data_validade = valores.data_validade;
  const codigo = valores.etiqueta_codigo.trim();
  if (codigo !== "" && (valores.etiqueta_tipo === "qr_code" || valores.etiqueta_tipo === "rfid")) {
    corpo.etiqueta = { tipo: valores.etiqueta_tipo, codigo };
  }
  return corpo;
}

export function listarLotes(cliente: Cliente, filtro: FiltroDeLotes, sinal?: AbortSignal): Promise<Pagina<Lote>> {
  return cliente.get<Pagina<Lote>>(
    "/lotes",
    {
      id_produto: filtro.id_produto,
      id_localizacao: filtro.id_localizacao,
      status: filtro.status,
      numero_lote: filtro.numero_lote,
      codigo_etiqueta: filtro.codigo_etiqueta,
      pagina: filtro.pagina,
      limite: filtro.limite,
    },
    sinal,
  );
}

export function obterLote(cliente: Cliente, id: number, sinal?: AbortSignal): Promise<Lote> {
  return cliente.get<Lote>(`/lotes/${segmento(id)}`, undefined, sinal);
}

export function criarLote(cliente: Cliente, corpo: CorpoDeLote): Promise<Lote> {
  return cliente.post<Lote>("/lotes", corpo);
}

export function bloquearLote(cliente: Cliente, id: number, motivo: string): Promise<Lote> {
  return cliente.post<Lote>(`/lotes/${segmento(id)}/bloquear`, { motivo: motivo.trim() });
}

export function desbloquearLote(cliente: Cliente, id: number): Promise<Lote> {
  return cliente.post<Lote>(`/lotes/${segmento(id)}/desbloquear`);
}

export function associarEtiqueta(cliente: Cliente, id: number, tipo: TipoEtiqueta, codigo: string): Promise<Etiqueta & { id_lote: number }> {
  return cliente.post<Etiqueta & { id_lote: number }>(`/lotes/${segmento(id)}/etiqueta`, { tipo, codigo: codigo.trim() });
}

export async function contarLotes(cliente: Cliente, status: StatusLote | undefined, sinal?: AbortSignal): Promise<number> {
  const pagina = await listarLotes(cliente, { status, limite: 1 }, sinal);
  return pagina.total;
}

export async function contarLotesAVencer(cliente: Cliente, sinal?: AbortSignal): Promise<number> {
  const pagina = await cliente.get<Pagina<unknown>>("/alertas/vencimento", { limite: 1 }, sinal);
  return pagina.total;
}

export function listarLocalizacoes(cliente: Cliente, sinal?: AbortSignal): Promise<Pagina<Localizacao>> {
  return cliente.get<Pagina<Localizacao>>("/localizacoes", { limite: 100 }, sinal);
}
