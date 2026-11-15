import { HttpError } from "../errors.ts";
import type { tipo_identificacao } from "../generated/prisma/enums.ts";
import { executarComoUsuario, type ContextoDeEscrita } from "../transacao.ts";

export type EtiquetaPublica = {
  id_identificacao: number;
  tipo_identificacao: tipo_identificacao;
  codigo: string;
  id_lote: number;
};

export function associarEtiqueta(
  contexto: ContextoDeEscrita,
  idLote: number,
  tipo: tipo_identificacao,
  codigo: string,
): Promise<EtiquetaPublica> {
  return executarComoUsuario(contexto, async (tx) => {
    const lote = await tx.lote.findUnique({ where: { id_lote: idLote }, select: { id_lote: true } });
    if (!lote) throw new HttpError(404, "NAO_ENCONTRADO", "Lote não encontrado");
    const doLote = await tx.identificacao.findUnique({ where: { id_lote: idLote }, select: { id_lote: true } });
    if (doLote) throw new HttpError(409, "LOTE_COM_ETIQUETA", "Lote já possui etiqueta");
    const usada = await tx.identificacao.findUnique({ where: { codigo }, select: { id_lote: true } });
    if (usada) throw new HttpError(409, "ETIQUETA_DUPLICADA", "Etiqueta já associada a outro lote");
    return tx.identificacao.create({
      data: { tipo_identificacao: tipo, codigo, id_lote: idLote },
      select: { id_identificacao: true, tipo_identificacao: true, codigo: true, id_lote: true },
    });
  });
}
