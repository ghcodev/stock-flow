import { ErroDaApi } from "../api/erros.ts";
import { compararDecimais, ehZero, SALDO_MAXIMO, somarDecimais, subtrairDecimais } from "./decimal.ts";
import { decimalValido, interpretarFalhaDeFormulario, normalizarDecimal, type ErrosDeCampos, type FalhaDeFormulario } from "./formularios.ts";
import { validarTextoOpcional } from "./movimentacao.ts";

export function divergenciaDaContagem(contado: string, saldoDaContagem: string): string {
  return subtrairDecimais(contado, saldoDaContagem) ?? "0";
}

export type TomDaDivergencia = "zero" | "sobra" | "falta";

export function tomDaDivergencia(divergencia: string): TomDaDivergencia {
  if (ehZero(divergencia)) return "zero";
  return divergencia.startsWith("-") ? "falta" : "sobra";
}

export function textoDaDivergencia(divergencia: string, formatar: (valor: string) => string): string {
  const tom = tomDaDivergencia(divergencia);
  if (tom === "zero") return "0";
  return tom === "sobra" ? `+${formatar(divergencia)}` : formatar(divergencia);
}

export type PrevisaoDeFinalizacao = {
  saldoFinal: string | null;
  problema: "negativo" | "excede" | null;
};

export function preverFinalizacao(saldoAtual: string, divergencia: string): PrevisaoDeFinalizacao {
  const saldoFinal = somarDecimais(saldoAtual, divergencia);
  if (saldoFinal === null) return { saldoFinal: null, problema: null };
  if (compararDecimais(saldoFinal, "0") < 0) return { saldoFinal, problema: "negativo" };
  if (compararDecimais(saldoFinal, SALDO_MAXIMO) > 0) return { saldoFinal, problema: "excede" };
  return { saldoFinal, problema: null };
}

export function validarContagem(quantidade: string, observacao: string): ErrosDeCampos {
  const erros: ErrosDeCampos = {};
  if (quantidade.trim() === "") erros["quantidade"] = "Informe a quantidade contada.";
  else if (!decimalValido(quantidade)) erros["quantidade"] = "Use um número não negativo com até 9 inteiros e 3 decimais.";
  const erroObservacao = validarTextoOpcional(observacao, 5000, "A observação");
  if (erroObservacao) erros["observacao"] = erroObservacao;
  return erros;
}

export function corpoDeContagem(idLote: number, quantidade: string, observacao: string): { id_lote: number; quantidade_contada: string; observacao?: string } {
  const corpo: { id_lote: number; quantidade_contada: string; observacao?: string } = { id_lote: idLote, quantidade_contada: normalizarDecimal(quantidade) };
  if (observacao.trim() !== "") corpo.observacao = observacao.trim();
  return corpo;
}

export function interpretarFalhaDeContagem(erro: unknown): FalhaDeFormulario {
  if (erro instanceof ErroDaApi && erro.status === 409 && erro.codigo === "CONTAGEM_PENDENTE_EXISTENTE") {
    return { geral: erro.message, campos: {}, incerta: false };
  }
  return interpretarFalhaDeFormulario(erro);
}

export type FalhaDeDecisao = { geral: string; atualizarLista: boolean; incerta: boolean; reler: boolean };

export function interpretarFalhaDeDecisao(erro: unknown): FalhaDeDecisao {
  if (erro instanceof ErroDaApi) {
    if (erro.status === 409 && erro.codigo === "CONTAGEM_JA_FINALIZADA") {
      return { geral: "Esta contagem não está mais pendente: outra pessoa já a finalizou ou cancelou. A lista será atualizada.", atualizarLista: true, incerta: false, reler: false };
    }
    if (erro.status === 409 && erro.codigo === "CONTAGEM_NAO_PENDENTE") {
      return { geral: "Somente contagem pendente pode ser cancelada. A lista será atualizada.", atualizarLista: true, incerta: false, reler: false };
    }
    if (erro.status === 409 && erro.codigo === "SALDO_FINAL_NEGATIVO") {
      return { geral: "O saldo atual do lote não comporta a divergência desta contagem: o saldo final ficaria negativo. Cancele a contagem ou registre outra.", atualizarLista: false, incerta: false, reler: true };
    }
    if (erro.status === 422 && erro.codigo === "SALDO_EXCEDE_LIMITE") {
      return { geral: "O saldo final excederia o limite permitido para o lote.", atualizarLista: false, incerta: false, reler: true };
    }
    if (erro.status === 404) return { geral: "Contagem não encontrada. A lista será atualizada.", atualizarLista: true, incerta: false, reler: false };
  }
  const base = interpretarFalhaDeFormulario(erro);
  return { geral: base.geral ?? "Não foi possível concluir a operação.", atualizarLista: base.incerta, incerta: base.incerta, reler: false };
}

export function idDeContagemValido(id: string): boolean {
  return /^[1-9]\d{0,17}$/.test(id);
}

export type LeituraDoSaldo = { saldo: string | null; carregando: boolean; erro: string | null };

export type DecisaoDeFinalizacao = {
  podeConfirmar: boolean;
  motivo: "lendo" | "falha" | "negativo" | "excede" | null;
  saldoFinal: string | null;
};

export function decidirFinalizacao(leitura: LeituraDoSaldo, divergencia: string): DecisaoDeFinalizacao {
  if (leitura.carregando) return { podeConfirmar: false, motivo: "lendo", saldoFinal: null };
  if (leitura.erro !== null || leitura.saldo === null) return { podeConfirmar: false, motivo: "falha", saldoFinal: null };
  const previsao = preverFinalizacao(leitura.saldo, divergencia);
  if (previsao.saldoFinal === null) return { podeConfirmar: false, motivo: "falha", saldoFinal: null };
  if (previsao.problema !== null) return { podeConfirmar: false, motivo: previsao.problema, saldoFinal: previsao.saldoFinal };
  return { podeConfirmar: true, motivo: null, saldoFinal: previsao.saldoFinal };
}
