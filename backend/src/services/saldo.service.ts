import { HttpError } from "../errors.ts";
import { Prisma } from "../generated/prisma/client.ts";
import type { status_lote, status_movimentacao, tipo_movimentacao } from "../generated/prisma/enums.ts";
import { executarComoUsuario, instanteDoBanco, type ContextoDeEscrita, type Tx } from "../transacao.ts";

export const LOCK_TIMEOUT_MS = 1500;
export const SALDO_MAXIMO = new Prisma.Decimal("999999999.999");

export type LoteTravado = {
  id_lote: number;
  id_produto: number;
  id_localizacao: number;
  status_lote: status_lote;
  quantidade: Prisma.Decimal;
  validade_expirada: boolean;
};

export type EfeitoNoLote = { quantidade?: Prisma.Decimal; id_localizacao?: number };

export type EfeitoDaOperacao = {
  tipo: tipo_movimentacao;
  quantidade: Prisma.Decimal;
  saldoPosterior: Prisma.Decimal;
  origem: number | null;
  destino: number | null;
  motivo?: string | null;
  observacao?: string | null;
  noLote: EfeitoNoLote;
};

export type DecisaoDoSaldo = (lote: LoteTravado, tx: Tx) => Promise<EfeitoDaOperacao>;

const SELECAO_MOVIMENTACAO = {
  id_movimentacao: true,
  tipo_movimentacao: true,
  data_movimentacao: true,
  quantidade: true,
  saldo_anterior: true,
  saldo_posterior: true,
  id_lote: true,
  id_usuario: true,
  id_localizacao_origem: true,
  id_localizacao_destino: true,
  motivo_movimentacao: true,
  observacao: true,
  status_movimentacao: true,
} as const;

export type MovimentacaoPublica = Prisma.movimentacaoGetPayload<{ select: typeof SELECAO_MOVIMENTACAO }>;

export { SELECAO_MOVIMENTACAO };

type LinhaDoLote = {
  id_lote: number;
  id_produto: number;
  id_localizacao: number;
  status_lote: status_lote;
  quantidade: Prisma.Decimal | string | number;
  validade_expirada: boolean;
};

export async function travarLote(tx: Tx, idLote: number): Promise<LoteTravado> {
  const [linha] = await tx.$queryRaw<LinhaDoLote[]>`
    SELECT id_lote, id_produto, id_localizacao, status_lote::text AS status_lote, quantidade,
           (data_validade IS NOT NULL AND data_validade < current_date) AS validade_expirada
    FROM lote WHERE id_lote = ${idLote} FOR UPDATE`;
  if (!linha) throw new HttpError(404, "NAO_ENCONTRADO", "Lote não encontrado");
  return { ...linha, quantidade: new Prisma.Decimal(linha.quantidade.toString()) };
}

export type DependenciasSaldo = {
  executar: typeof executarComoUsuario;
  travar: (tx: Tx, idLote: number) => Promise<LoteTravado>;
  instante: (tx: Tx) => Promise<Date>;
};

const dependenciasReais: DependenciasSaldo = {
  executar: executarComoUsuario,
  travar: travarLote,
  instante: instanteDoBanco,
};

export function criarAlteradorDeSaldo(dependencias: DependenciasSaldo = dependenciasReais) {
  return (contexto: ContextoDeEscrita, idLote: number, decidir: DecisaoDoSaldo): Promise<MovimentacaoPublica> =>
    dependencias.executar(
      contexto,
      async (tx) => {
        const lote = await dependencias.travar(tx, idLote);
        const efeito = await decidir(lote, tx);
        const instante = await dependencias.instante(tx);
        await tx.lote.update({
          where: { id_lote: idLote },
          data: {
            ...(efeito.noLote.quantidade === undefined ? {} : { quantidade: efeito.noLote.quantidade }),
            ...(efeito.noLote.id_localizacao === undefined ? {} : { id_localizacao: efeito.noLote.id_localizacao }),
          },
          select: { id_lote: true },
        });
        return tx.movimentacao.create({
          data: {
            tipo_movimentacao: efeito.tipo,
            data_movimentacao: instante,
            quantidade: efeito.quantidade,
            saldo_anterior: lote.quantidade,
            saldo_posterior: efeito.saldoPosterior,
            id_lote: idLote,
            id_usuario: contexto.idUsuario,
            id_localizacao_origem: efeito.origem,
            id_localizacao_destino: efeito.destino,
            motivo_movimentacao: efeito.motivo ?? null,
            observacao: efeito.observacao ?? null,
            status_movimentacao: "concluida" satisfies status_movimentacao,
          },
          select: SELECAO_MOVIMENTACAO,
        });
      },
      { lockTimeoutMs: LOCK_TIMEOUT_MS },
    );
}

export const alterarSaldo = criarAlteradorDeSaldo();
