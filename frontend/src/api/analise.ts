import type { Cliente } from "./cliente.ts";
import type { Consulta, MovimentacaoDoHistorico, Pagina, Rastreabilidade, RegistroDeAuditoria, Usuario } from "./tipos.ts";
import type { PaginaDeCursor } from "../hooks/useListaComCursor.ts";

export const LIMITE_POR_PAGINA = 50;

type ComCursorDeTras<T> = Pagina<T> & { proximo_antes_de_id: string | null };

export async function listarAuditoria(cliente: Cliente, consulta: Consulta, cursor: string | undefined, sinal: AbortSignal): Promise<PaginaDeCursor<RegistroDeAuditoria>> {
  const resposta = await cliente.get<ComCursorDeTras<RegistroDeAuditoria>>("/auditoria", { ...consulta, limite: LIMITE_POR_PAGINA, antes_de_id: cursor }, sinal);
  return { dados: resposta.dados, proximo: resposta.proximo_antes_de_id, total: resposta.total };
}

export async function listarHistorico(cliente: Cliente, consulta: Consulta, cursor: string | undefined, sinal: AbortSignal): Promise<PaginaDeCursor<MovimentacaoDoHistorico>> {
  const resposta = await cliente.get<ComCursorDeTras<MovimentacaoDoHistorico>>("/movimentacoes", { ...consulta, limite: LIMITE_POR_PAGINA, antes_de_id: cursor }, sinal);
  return { dados: resposta.dados, proximo: resposta.proximo_antes_de_id, total: resposta.total };
}

export type AlvoDaRastreabilidade = { tipo: "numero"; valor: string } | { tipo: "id"; valor: number };

export function rastrear(cliente: Cliente, alvo: AlvoDaRastreabilidade, cursor: string | undefined, sinal: AbortSignal): Promise<Rastreabilidade> {
  return cliente.get<Rastreabilidade>(
    "/rastreabilidade",
    {
      numero_lote: alvo.tipo === "numero" ? alvo.valor : undefined,
      id_lote: alvo.tipo === "id" ? alvo.valor : undefined,
      depois_de_id: cursor,
      limite: LIMITE_POR_PAGINA,
    },
    sinal,
  );
}

export async function buscarUsuariosParaSeletor(cliente: Cliente, texto: string, sinal: AbortSignal): Promise<{ valor: string; rotulo: string }[]> {
  const resposta = await cliente.get<Pagina<Usuario>>("/usuarios", { busca: texto === "" ? undefined : texto, limite: 30 }, sinal);
  return resposta.dados.map((usuario) => ({ valor: String(usuario.id_usuario), rotulo: `${usuario.nome} (${usuario.email})` }));
}
