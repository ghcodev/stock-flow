import { ErroDaApi } from "../api/erros.ts";
import type { Lote } from "../api/tipos.ts";
import { compararDecimais } from "./decimal.ts";
import { contemNul, decimalValido, normalizarDecimal, type ErrosDeCampos } from "./formularios.ts";
import { interpretarFalhaDeMovimentacao, type FalhaDeMovimentacao } from "./movimentacao.ts";

export const MINIMO_DA_JUSTIFICATIVA = 10;
export const MAXIMO_DA_JUSTIFICATIVA = 255;

export function validarJustificativaDoAjuste(texto: string): string | null {
  const limpo = texto.trim();
  if (contemNul(limpo)) return "A justificativa contém caractere inválido.";
  if (limpo.length < MINIMO_DA_JUSTIFICATIVA) return `A justificativa deve ter no mínimo ${MINIMO_DA_JUSTIFICATIVA} caracteres (sem contar espaços nas pontas).`;
  if (limpo.length > MAXIMO_DA_JUSTIFICATIVA) return `A justificativa deve ter até ${MAXIMO_DA_JUSTIFICATIVA} caracteres.`;
  return null;
}

export function validarAjuste(lote: Pick<Lote, "quantidade">, novoSaldo: string, justificativa: string): ErrosDeCampos {
  const erros: ErrosDeCampos = {};
  if (novoSaldo.trim() === "") erros["novo_saldo"] = "Informe o novo saldo.";
  else if (!decimalValido(novoSaldo)) erros["novo_saldo"] = "Use um número não negativo com até 9 inteiros e 3 decimais.";
  else if (compararDecimais(normalizarDecimal(novoSaldo), lote.quantidade) === 0) erros["novo_saldo"] = "O novo saldo é igual ao saldo atual: não há o que ajustar.";
  const erroDaJustificativa = validarJustificativaDoAjuste(justificativa);
  if (erroDaJustificativa) erros["motivo"] = erroDaJustificativa;
  return erros;
}

export type CorpoDeAjuste = { id_lote: number; saldo_exibido: string; novo_saldo: string; motivo: string };

export function corpoDeAjuste(lote: Pick<Lote, "id_lote" | "quantidade">, novoSaldo: string, justificativa: string): CorpoDeAjuste {
  return { id_lote: lote.id_lote, saldo_exibido: lote.quantidade, novo_saldo: normalizarDecimal(novoSaldo), motivo: justificativa.trim() };
}

export function avisoDoAjuste(lote: Pick<Lote, "status_lote" | "validade_expirada">): string | null {
  if (lote.status_lote === "bloqueado") return "Lote bloqueado: o ajuste é permitido, mas confira o lote antes de gravar.";
  if (lote.status_lote === "vencido") return "Lote vencido: o ajuste é permitido, mas confira o lote antes de gravar.";
  if (lote.validade_expirada === true) return "A validade deste lote já passou: o ajuste é permitido, mas confira o lote antes de gravar.";
  return null;
}

export function interpretarFalhaDeAjuste(erro: unknown): FalhaDeMovimentacao {
  if (erro instanceof ErroDaApi && erro.status === 409 && erro.codigo === "SALDO_DESATUALIZADO") {
    return {
      geral: "O saldo do lote mudou desde que foi exibido. O saldo está sendo recarregado: confira o valor atual e confirme o ajuste de novo.",
      campos: {},
      atualizarLote: true,
      incerta: false,
    };
  }
  if (erro instanceof ErroDaApi && erro.status === 422 && erro.codigo === "AJUSTE_SEM_ALTERACAO") {
    return { geral: "O novo saldo é igual ao saldo atual do lote. Recarregue o saldo e informe outro valor.", campos: { novo_saldo: "O novo saldo é igual ao saldo atual." }, atualizarLote: true, incerta: false };
  }
  return interpretarFalhaDeMovimentacao(erro);
}
