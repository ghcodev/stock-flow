import { HttpError } from "../errors.ts";
import { prisma } from "../db.ts";
import { fimExclusivoDoPeriodo, inicioDoPeriodo, lerInstante } from "../periodo.ts";
import { Prisma } from "../generated/prisma/client.ts";
import type { tipo_movimentacao } from "../generated/prisma/enums.ts";
import type { ContextoDeEscrita } from "../transacao.ts";
import { intervaloDe, type Pagina, type Paginacao } from "../validators/comuns.ts";
import { alterarSaldo, SALDO_MAXIMO, SELECAO_MOVIMENTACAO, type MovimentacaoPublica } from "./saldo.service.ts";

export type DadosSaldo = {
  id_lote: number;
  quantidade: string;
  motivo?: string | null;
  observacao?: string | null;
};

export function registrarEntrada(contexto: ContextoDeEscrita, dados: DadosSaldo): Promise<MovimentacaoPublica> {
  const quantidade = new Prisma.Decimal(dados.quantidade);
  return alterarSaldo(contexto, dados.id_lote, async (lote) => {
    const saldoPosterior = lote.quantidade.plus(quantidade);
    if (saldoPosterior.gt(SALDO_MAXIMO)) {
      throw new HttpError(422, "SALDO_EXCEDE_LIMITE", "O saldo do lote excederia o limite permitido");
    }
    return {
      tipo: "entrada",
      quantidade,
      saldoPosterior,
      origem: null,
      destino: lote.id_localizacao,
      motivo: dados.motivo ?? null,
      observacao: dados.observacao ?? null,
      noLote: { quantidade: saldoPosterior },
    };
  });
}

export function registrarSaida(contexto: ContextoDeEscrita, dados: DadosSaldo): Promise<MovimentacaoPublica> {
  const quantidade = new Prisma.Decimal(dados.quantidade);
  return alterarSaldo(contexto, dados.id_lote, async (lote) => {
    if (lote.status_lote !== "ativo" || lote.validade_expirada) {
      throw new HttpError(422, "LOTE_INDISPONIVEL", "Saída não permitida para lote vencido, com validade expirada ou bloqueado");
    }
    if (quantidade.gt(lote.quantidade)) {
      throw new HttpError(409, "SALDO_INSUFICIENTE", "Saldo insuficiente no lote");
    }
    const saldoPosterior = lote.quantidade.minus(quantidade);
    return {
      tipo: "saida",
      quantidade,
      saldoPosterior,
      origem: lote.id_localizacao,
      destino: null,
      motivo: dados.motivo ?? null,
      observacao: dados.observacao ?? null,
      noLote: { quantidade: saldoPosterior },
    };
  });
}

export type DadosTransferencia = {
  id_lote: number;
  id_localizacao_destino: number;
  motivo: string;
  observacao?: string | null;
};

export function registrarTransferencia(
  contexto: ContextoDeEscrita,
  dados: DadosTransferencia,
): Promise<MovimentacaoPublica> {
  return alterarSaldo(contexto, dados.id_lote, async (lote, tx) => {
    if (lote.status_lote !== "ativo") {
      throw new HttpError(422, "LOTE_INDISPONIVEL", "Somente lote ativo pode ser transferido");
    }
    if (dados.id_localizacao_destino === lote.id_localizacao) {
      throw new HttpError(422, "DESTINO_IGUAL_ORIGEM", "O destino deve ser diferente da localização atual do lote");
    }
    const destino = await tx.localizacao.findUnique({
      where: { id_localizacao: dados.id_localizacao_destino },
      select: { id_localizacao: true },
    });
    if (!destino) throw new HttpError(422, "LOCALIZACAO_INVALIDA", "Localização de destino não encontrada");
    if (lote.quantidade.lte(0)) {
      throw new HttpError(422, "LOTE_SEM_SALDO", "Lote sem saldo não pode ser transferido");
    }
    return {
      tipo: "transferencia",
      quantidade: lote.quantidade,
      saldoPosterior: lote.quantidade,
      origem: lote.id_localizacao,
      destino: dados.id_localizacao_destino,
      motivo: dados.motivo,
      observacao: dados.observacao ?? null,
      noLote: { id_localizacao: dados.id_localizacao_destino },
    };
  });
}

export type FiltroHistorico = Paginacao & {
  de?: string;
  ate?: string;
  tipo?: tipo_movimentacao;
  id_lote?: number;
  id_usuario?: number;
};

function instanteDoFiltro(texto: string) {
  const instante = lerInstante(texto);
  if (!instante) throw new HttpError(400, "VALIDACAO", "Período inválido");
  return instante;
}

export async function listarHistorico(filtro: FiltroHistorico): Promise<Pagina<MovimentacaoPublica>> {
  const { pagina, limite, skip, take } = intervaloDe(filtro);
  const where: Prisma.movimentacaoWhereInput = {
    ...(filtro.tipo === undefined ? {} : { tipo_movimentacao: filtro.tipo }),
    ...(filtro.id_lote === undefined ? {} : { id_lote: filtro.id_lote }),
    ...(filtro.id_usuario === undefined ? {} : { id_usuario: filtro.id_usuario }),
    ...(filtro.de === undefined && filtro.ate === undefined
      ? {}
      : {
          data_movimentacao: {
            ...(filtro.de === undefined ? {} : { gte: inicioDoPeriodo(instanteDoFiltro(filtro.de)) }),
            ...(filtro.ate === undefined ? {} : { lt: fimExclusivoDoPeriodo(instanteDoFiltro(filtro.ate)) }),
          },
        }),
  };
  const [dados, total] = await Promise.all([
    prisma.movimentacao.findMany({
      where,
      select: SELECAO_MOVIMENTACAO,
      orderBy: [{ data_movimentacao: "desc" }, { id_movimentacao: "desc" }],
      skip,
      take,
    }),
    prisma.movimentacao.count({ where }),
  ]);
  return { dados, pagina, limite, total };
}

export async function obterMovimentacao(id: string): Promise<MovimentacaoPublica> {
  const movimentacao = await prisma.movimentacao.findUnique({
    where: { id_movimentacao: BigInt(id) },
    select: SELECAO_MOVIMENTACAO,
  });
  if (!movimentacao) throw new HttpError(404, "NAO_ENCONTRADO", "Movimentação não encontrada");
  return movimentacao;
}
