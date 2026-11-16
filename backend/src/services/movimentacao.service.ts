import { HttpError } from "../errors.ts";
import { prisma } from "../db.ts";
import { fimExclusivoDoPeriodo, inicioDoPeriodo, lerInstante } from "../periodo.ts";
import { Prisma } from "../generated/prisma/client.ts";
import type { tipo_movimentacao } from "../generated/prisma/enums.ts";
import type { ContextoDeEscrita } from "../transacao.ts";
import { intervaloDe, type Pagina, type Paginacao } from "../validators/comuns.ts";
import {
  alterarSaldo,
  comNomes,
  SALDO_MAXIMO,
  SELECAO_COM_NOMES,
  type MovimentacaoComNomes,
  type MovimentacaoPublica,
} from "./saldo.service.ts";

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
  antes_de_id?: string;
};

export type PaginaDeHistorico = Pagina<MovimentacaoComNomes> & { proximo_antes_de_id: string | null };

function instanteDoFiltro(texto: string) {
  const instante = lerInstante(texto);
  if (!instante) throw new HttpError(400, "VALIDACAO", "Período inválido");
  return instante;
}

export async function listarHistorico(filtro: FiltroHistorico): Promise<PaginaDeHistorico> {
  const { pagina, limite, skip, take } = intervaloDe(filtro);
  const where: Prisma.movimentacaoWhereInput = {
    ...(filtro.tipo === undefined ? {} : { tipo_movimentacao: filtro.tipo }),
    ...(filtro.id_lote === undefined ? {} : { id_lote: filtro.id_lote }),
    ...(filtro.id_usuario === undefined ? {} : { id_usuario: filtro.id_usuario }),
    ...(filtro.antes_de_id === undefined ? {} : { id_movimentacao: { lt: BigInt(filtro.antes_de_id) } }),
    ...(filtro.de === undefined && filtro.ate === undefined
      ? {}
      : {
          data_movimentacao: {
            ...(filtro.de === undefined ? {} : { gte: inicioDoPeriodo(instanteDoFiltro(filtro.de)) }),
            ...(filtro.ate === undefined ? {} : { lt: fimExclusivoDoPeriodo(instanteDoFiltro(filtro.ate)) }),
          },
        }),
  };
  const [linhas, total] = await Promise.all([
    prisma.movimentacao.findMany({
      where,
      select: SELECAO_COM_NOMES,
      orderBy: [{ id_movimentacao: "desc" }],
      skip,
      take,
    }),
    prisma.movimentacao.count({ where }),
  ]);
  const dados = linhas.map(comNomes);
  const haMais = skip + dados.length < total;
  const proximo = haMais ? (dados.at(-1)?.id_movimentacao.toString() ?? null) : null;
  return { dados, pagina, limite, total, proximo_antes_de_id: proximo };
}

export async function obterMovimentacao(id: string): Promise<MovimentacaoComNomes> {
  const movimentacao = await prisma.movimentacao.findUnique({
    where: { id_movimentacao: BigInt(id) },
    select: SELECAO_COM_NOMES,
  });
  if (!movimentacao) throw new HttpError(404, "NAO_ENCONTRADO", "Movimentação não encontrada");
  return comNomes(movimentacao);
}

export type DadosAjuste = {
  id_lote: number;
  saldo_exibido: string;
  novo_saldo: string;
  motivo: string;
};

export function registrarAjuste(contexto: ContextoDeEscrita, dados: DadosAjuste): Promise<MovimentacaoPublica> {
  const saldoExibido = new Prisma.Decimal(dados.saldo_exibido);
  const novoSaldo = new Prisma.Decimal(dados.novo_saldo);
  return alterarSaldo(contexto, dados.id_lote, async (lote) => {
    if (!lote.quantidade.eq(saldoExibido)) {
      throw new HttpError(409, "SALDO_DESATUALIZADO", "O saldo do lote mudou desde que foi exibido");
    }
    const diferenca = novoSaldo.minus(lote.quantidade);
    if (diferenca.isZero()) {
      throw new HttpError(422, "AJUSTE_SEM_ALTERACAO", "O novo saldo é igual ao saldo atual do lote");
    }
    return {
      tipo: "ajuste",
      quantidade: diferenca.abs(),
      saldoPosterior: novoSaldo,
      origem: null,
      destino: null,
      motivo: dados.motivo,
      observacao: null,
      noLote: { quantidade: novoSaldo },
    };
  });
}
