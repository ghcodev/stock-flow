import { HttpError } from "../errors.ts";
import { Prisma } from "../generated/prisma/client.ts";
import type { ContextoDeEscrita } from "../transacao.ts";
import { alterarSaldo, SALDO_MAXIMO, type MovimentacaoPublica } from "./saldo.service.ts";

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
