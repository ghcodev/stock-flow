import { ErroDaApi, ErroDeRede, mensagemDoErro } from "../api/erros.ts";
import type { Lote } from "../api/tipos.ts";
import { compararDecimais, ehZero, formatarQuantidade, SALDO_MAXIMO, somarDecimais, subtrairDecimais } from "./decimal.ts";
import { contemNul, decimalValido, idValido, normalizarDecimal, type ErrosDeCampos } from "./formularios.ts";

type DadosDoLote = Pick<Lote, "status_lote" | "data_validade" | "quantidade" | "id_localizacao" | "produto">;

export type ModoDeSaldo = "entrada" | "saida";

export type AvaliacaoDeQuantidade = {
  erro: string | null;
  saldoApos: string | null;
};

function validadeExpirada(lote: Pick<Lote, "data_validade">, hoje: string): boolean {
  return lote.data_validade !== null && lote.data_validade < hoje;
}

export function bloqueioDaSaida(lote: Pick<Lote, "status_lote" | "data_validade">, hoje: string): string | null {
  if (lote.status_lote === "bloqueado") return "Lote bloqueado: a saída não é permitida. Desbloqueie o lote antes.";
  if (lote.status_lote === "vencido") return "Lote vencido: a saída não é permitida.";
  if (validadeExpirada(lote, hoje)) return "Lote com validade expirada: a saída não é permitida.";
  return null;
}

export function bloqueioDaTransferencia(lote: Pick<Lote, "status_lote" | "quantidade">): string | null {
  if (lote.status_lote !== "ativo") return "Somente lote ativo pode ser transferido.";
  if (ehZero(lote.quantidade)) return "Lote sem saldo não pode ser transferido.";
  return null;
}

export function avisoDaEntrada(lote: Pick<Lote, "status_lote" | "data_validade">, hoje: string): string | null {
  if (lote.status_lote === "bloqueado") return "Este lote está bloqueado. A entrada é permitida, mas confira o lote antes de registrar.";
  if (lote.status_lote === "vencido") return "Este lote está vencido. A entrada é permitida, mas confira o lote antes de registrar.";
  if (validadeExpirada(lote, hoje)) return "A validade deste lote já passou. A entrada é permitida, mas confira o lote antes de registrar.";
  return null;
}

export function avaliarQuantidade(texto: string, lote: DadosDoLote, modo: ModoDeSaldo): AvaliacaoDeQuantidade {
  const limpo = texto.trim();
  if (limpo === "") return { erro: null, saldoApos: null };
  if (!decimalValido(limpo)) return { erro: "Use um número com até 9 inteiros e 3 decimais.", saldoApos: null };
  const quantidade = normalizarDecimal(limpo);
  if (ehZero(quantidade)) return { erro: "A quantidade deve ser maior que zero.", saldoApos: null };
  if (modo === "saida") {
    if (compararDecimais(quantidade, lote.quantidade) > 0) {
      return { erro: `Saldo insuficiente: disponível ${formatarQuantidade(lote.quantidade)} ${lote.produto.unidade_medida}.`, saldoApos: null };
    }
    return { erro: null, saldoApos: subtrairDecimais(lote.quantidade, quantidade) };
  }
  const apos = somarDecimais(lote.quantidade, quantidade);
  if (apos !== null && compararDecimais(apos, SALDO_MAXIMO) > 0) return { erro: "O saldo do lote excederia o limite permitido.", saldoApos: null };
  return { erro: null, saldoApos: apos };
}

export function validarDestino(lote: Pick<Lote, "id_localizacao">, idDestino: string): string | null {
  if (idDestino === "") return "Selecione a localização de destino.";
  if (!idValido(idDestino)) return "Localização de destino inválida.";
  if (Number(idDestino) === lote.id_localizacao) return "O destino deve ser diferente da localização atual do lote.";
  return null;
}

export function validarTextoOpcional(texto: string, maximo: number, rotulo: string): string | null {
  if (contemNul(texto)) return `${rotulo} contém caractere inválido.`;
  return texto.trim().length > maximo ? `${rotulo} deve ter até ${maximo} caracteres.` : null;
}

export function validarJustificativa(texto: string): string | null {
  const limpo = texto.trim();
  if (limpo === "") return "Informe a justificativa da transferência.";
  if (contemNul(limpo)) return "A justificativa contém caractere inválido.";
  return limpo.length > 255 ? "A justificativa deve ter até 255 caracteres." : null;
}

export type FalhaDeMovimentacao = {
  geral: string | null;
  campos: ErrosDeCampos;
  atualizarLote: boolean;
  incerta: boolean;
};

export function interpretarFalhaDeMovimentacao(erro: unknown): FalhaDeMovimentacao {
  const base: FalhaDeMovimentacao = { geral: null, campos: {}, atualizarLote: false, incerta: false };
  if (erro instanceof ErroDeRede) {
    return {
      ...base,
      incerta: true,
      geral:
        erro.motivo === "CANCELADO"
          ? "A operação foi cancelada."
          : "Não houve confirmação do servidor. Confira o histórico de movimentações antes de repetir, para não duplicar a operação.",
    };
  }
  if (!(erro instanceof ErroDaApi)) return { ...base, geral: "Não foi possível concluir a operação." };
  if (erro.status === 400) {
    const campos: ErrosDeCampos = {};
    for (const item of erro.campos) if (campos[item.campo] === undefined) campos[item.campo] = item.mensagem;
    return Object.keys(campos).length > 0 ? { ...base, campos } : { ...base, geral: "Verifique os dados informados." };
  }
  if (erro.status === 409 && erro.codigo === "LOTE_EM_USO") {
    return { ...base, atualizarLote: true, geral: "O lote está em uso por outra operação. Aguarde um instante e tente de novo." };
  }
  if (erro.status === 409 && erro.codigo === "SALDO_INSUFICIENTE") {
    return { ...base, atualizarLote: true, geral: "Saldo insuficiente: o saldo do lote mudou. Confira o saldo atualizado e ajuste a quantidade." };
  }
  if (erro.status === 409 || erro.status === 422) return { ...base, atualizarLote: true, geral: erro.message };
  if (erro.status === 404) return { ...base, atualizarLote: true, geral: "Lote não encontrado." };
  if (erro.status === 503) return { ...base, geral: "O servidor está ocupado. Tente novamente em instantes." };
  if (erro.status >= 500) {
    return { ...base, incerta: true, geral: "O servidor não conseguiu concluir. Confira o histórico de movimentações antes de repetir." };
  }
  return { ...base, geral: mensagemDoErro(erro) };
}
