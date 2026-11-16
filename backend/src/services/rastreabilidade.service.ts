import { prisma } from "../db.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { HttpError } from "../errors.ts";
import { intervaloDe, type Paginacao } from "../validators/comuns.ts";
import { obterLote, type LotePublico } from "./lote.service.ts";
import { SELECAO_MOVIMENTACAO } from "./saldo.service.ts";

export type FiltroRastreabilidade = Paginacao & { numero_lote?: string; id_lote?: number; depois_de_id?: string };

type Posicao = { id_localizacao: number; corredor: string; nivel: string; posicao: string };

export type EventoDaLinhaDoTempo = {
  id_movimentacao: bigint;
  data_movimentacao: Date;
  tipo_movimentacao: string;
  status_movimentacao: string;
  quantidade: unknown;
  saldo_anterior: unknown;
  saldo_posterior: unknown;
  usuario: { id_usuario: number; nome: string };
  origem: Posicao | null;
  destino: Posicao | null;
  motivo_movimentacao: string | null;
  observacao: string | null;
};

export type Rastreabilidade = {
  lote: LotePublico;
  linha_do_tempo: EventoDaLinhaDoTempo[];
  pagina: number;
  limite: number;
  total: number;
  proximo_depois_de_id: string | null;
};

const LIMITE_PADRAO = 50;

const POSICAO = { select: { id_localizacao: true, corredor: true, nivel: true, posicao: true } } as const;

async function identificar(filtro: FiltroRastreabilidade): Promise<number> {
  if (filtro.id_lote !== undefined) return filtro.id_lote;
  const lote = await prisma.lote.findUnique({
    where: { numero_lote: filtro.numero_lote ?? "" },
    select: { id_lote: true },
  });
  if (!lote) throw new HttpError(404, "NAO_ENCONTRADO", "Lote não encontrado");
  return lote.id_lote;
}

export async function rastrearLote(filtro: FiltroRastreabilidade): Promise<Rastreabilidade> {
  const idLote = await identificar(filtro);
  const lote = await obterLote(idLote);
  const { pagina, limite, skip } = intervaloDe({ pagina: filtro.pagina, limite: filtro.limite ?? LIMITE_PADRAO });
  const total = await prisma.movimentacao.count({ where: { id_lote: idLote } });
  let onde: Prisma.movimentacaoWhereInput = { id_lote: idLote };
  if (filtro.depois_de_id !== undefined) {
    const referencia = await prisma.movimentacao.findFirst({
      where: { id_movimentacao: BigInt(filtro.depois_de_id), id_lote: idLote },
      select: { id_movimentacao: true, data_movimentacao: true },
    });
    if (!referencia) throw new HttpError(400, "VALIDACAO", "Cursor não pertence a este lote");
    onde = {
      id_lote: idLote,
      OR: [
        { data_movimentacao: { gt: referencia.data_movimentacao } },
        { data_movimentacao: referencia.data_movimentacao, id_movimentacao: { gt: referencia.id_movimentacao } },
      ],
    };
  }
  const pagina_lida = await prisma.movimentacao.findMany({
    where: onde,
    skip: filtro.depois_de_id === undefined ? skip : 0,
    take: limite + 1,
    orderBy: [{ data_movimentacao: "asc" }, { id_movimentacao: "asc" }],
    select: {
      ...SELECAO_MOVIMENTACAO,
      usuario: { select: { id_usuario: true, nome: true } },
      localizacao_movimentacao_id_localizacao_origemTolocalizacao: POSICAO,
      localizacao_movimentacao_id_localizacao_destinoTolocalizacao: POSICAO,
    },
  });
  const haMais = pagina_lida.length > limite;
  const movimentacoes = haMais ? pagina_lida.slice(0, limite) : pagina_lida;
  const linha_do_tempo = movimentacoes.map((m) => ({
    id_movimentacao: m.id_movimentacao,
    data_movimentacao: m.data_movimentacao,
    tipo_movimentacao: m.tipo_movimentacao,
    status_movimentacao: m.status_movimentacao,
    quantidade: m.quantidade,
    saldo_anterior: m.saldo_anterior,
    saldo_posterior: m.saldo_posterior,
    usuario: m.usuario,
    origem: m.localizacao_movimentacao_id_localizacao_origemTolocalizacao,
    destino: m.localizacao_movimentacao_id_localizacao_destinoTolocalizacao,
    motivo_movimentacao: m.motivo_movimentacao,
    observacao: m.observacao,
  }));
  const ultimo = linha_do_tempo.at(-1);
  return {
    lote,
    linha_do_tempo,
    pagina,
    limite,
    total,
    proximo_depois_de_id: haMais && ultimo ? ultimo.id_movimentacao.toString() : null,
  };
}
