import { ErroDaApi, ErroDeRede, mensagemDoErro } from "../api/erros.ts";
import { ehDiaValido } from "./datas.ts";

export type ErrosDeCampos = Record<string, string>;

export type FalhaDeFormulario = {
  geral: string | null;
  campos: ErrosDeCampos;
  incerta: boolean;
};

const NUMERIC_12_3 = /^\d{1,9}(\.\d{1,3})?$/;
const CONTROLE = /[\u0000-\u001f\u007f]/;

export const MAX_ID = 2_147_483_647;

export function contemNul(texto: string): boolean {
  return texto.includes("\u0000");
}

export function idValido(texto: string): boolean {
  return /^[1-9]\d{0,9}$/.test(texto) && Number(texto) <= MAX_ID;
}

export function normalizarDecimal(texto: string): string {
  return texto.trim().replace(",", ".");
}

export function decimalValido(texto: string): boolean {
  return NUMERIC_12_3.test(normalizarDecimal(texto));
}

export function codigoDeEtiquetaValido(codigo: string): boolean {
  const limpo = codigo.trim();
  return limpo.length >= 1 && limpo.length <= 128 && !CONTROLE.test(limpo);
}

const MENSAGEM_DE_RESULTADO_DESCONHECIDO =
  "Não houve confirmação do servidor e o resultado é desconhecido. Os dados da tela foram recarregados: confira antes de repetir.";

export function interpretarFalhaDeFormulario(erro: unknown): FalhaDeFormulario {
  if (erro instanceof ErroDaApi) {
    if (erro.status === 400 && erro.campos.length > 0) {
      const campos: ErrosDeCampos = {};
      for (const item of erro.campos) {
        if (campos[item.campo] === undefined) campos[item.campo] = item.mensagem;
      }
      return { geral: null, campos, incerta: false };
    }
    if (erro.status === 409 || erro.status === 422 || erro.status === 404 || erro.status === 403) {
      return { geral: erro.message, campos: {}, incerta: false };
    }
    if (erro.status >= 500 && erro.status !== 503) return { geral: MENSAGEM_DE_RESULTADO_DESCONHECIDO, campos: {}, incerta: true };
  }
  if (erro instanceof ErroDeRede && erro.motivo !== "CANCELADO") return { geral: MENSAGEM_DE_RESULTADO_DESCONHECIDO, campos: {}, incerta: true };
  return { geral: mensagemDoErro(erro), campos: {}, incerta: false };
}

export type ValoresDeProduto = {
  nome: string;
  categoria: string;
  descricao: string;
  unidade_medida: string;
  estoque_minimo: string;
};

export function validarProduto(valores: ValoresDeProduto): ErrosDeCampos {
  const erros: ErrosDeCampos = {};
  const nome = valores.nome.trim();
  if (nome === "") erros["nome"] = "Informe o nome do produto.";
  else if (nome.length > 120) erros["nome"] = "O nome deve ter até 120 caracteres.";
  else if (contemNul(nome)) erros["nome"] = "O nome contém caractere inválido.";
  if (valores.categoria.trim().length > 60) erros["categoria"] = "A categoria deve ter até 60 caracteres.";
  else if (contemNul(valores.categoria)) erros["categoria"] = "A categoria contém caractere inválido.";
  if (valores.descricao.trim().length > 5000) erros["descricao"] = "A descrição deve ter até 5000 caracteres.";
  else if (contemNul(valores.descricao)) erros["descricao"] = "A descrição contém caractere inválido.";
  const unidade = valores.unidade_medida.trim();
  if (unidade === "") erros["unidade_medida"] = "Informe a unidade de medida.";
  else if (unidade.length > 10) erros["unidade_medida"] = "A unidade deve ter até 10 caracteres.";
  else if (contemNul(unidade)) erros["unidade_medida"] = "A unidade contém caractere inválido.";
  if (valores.estoque_minimo.trim() !== "" && !decimalValido(valores.estoque_minimo)) {
    erros["estoque_minimo"] = "Use um número não negativo com até 9 inteiros e 3 decimais.";
  }
  return erros;
}

export type ValoresDeLote = {
  numero_lote: string;
  id_produto: string;
  id_localizacao: string;
  quantidade: string;
  data_fabricacao: string;
  data_validade: string;
  etiqueta_tipo: string;
  etiqueta_codigo: string;
};

export function validarLote(valores: ValoresDeLote): ErrosDeCampos {
  const erros: ErrosDeCampos = {};
  const numero = valores.numero_lote.trim();
  if (numero === "") erros["numero_lote"] = "Informe o número do lote.";
  else if (numero.length > 50) erros["numero_lote"] = "O número do lote deve ter até 50 caracteres.";
  else if (contemNul(numero)) erros["numero_lote"] = "O número do lote contém caractere inválido.";
  if (valores.id_produto === "") erros["id_produto"] = "Selecione o produto.";
  else if (!idValido(valores.id_produto)) erros["id_produto"] = "Produto inválido.";
  if (valores.id_localizacao === "") erros["id_localizacao"] = "Selecione a localização.";
  else if (!idValido(valores.id_localizacao)) erros["id_localizacao"] = "Localização inválida.";
  if (valores.quantidade.trim() !== "" && !decimalValido(valores.quantidade)) {
    erros["quantidade"] = "Use um número não negativo com até 9 inteiros e 3 decimais.";
  }
  if (valores.data_fabricacao !== "" && !ehDiaValido(valores.data_fabricacao)) erros["data_fabricacao"] = "Informe uma data válida.";
  if (valores.data_validade !== "" && !ehDiaValido(valores.data_validade)) erros["data_validade"] = "Informe uma data válida.";
  if (
    erros["data_fabricacao"] === undefined &&
    erros["data_validade"] === undefined &&
    valores.data_fabricacao !== "" &&
    valores.data_validade !== "" &&
    valores.data_validade < valores.data_fabricacao
  ) {
    erros["data_validade"] = "A validade não pode ser anterior à fabricação.";
  }
  const codigo = valores.etiqueta_codigo.trim();
  if (codigo !== "" || valores.etiqueta_tipo !== "") {
    if (valores.etiqueta_tipo !== "qr_code" && valores.etiqueta_tipo !== "rfid") erros["etiqueta_tipo"] = "Selecione o tipo da etiqueta.";
    if (!codigoDeEtiquetaValido(codigo)) erros["etiqueta_codigo"] = "Informe o código da etiqueta (1 a 128 caracteres, sem caracteres de controle).";
  }
  return erros;
}

export function validarMotivo(motivo: string): string | null {
  const limpo = motivo.trim();
  if (limpo === "") return "Informe o motivo do bloqueio.";
  if (limpo.length > 500) return "O motivo deve ter até 500 caracteres.";
  if (contemNul(limpo)) return "O motivo contém caractere inválido.";
  return null;
}

export function validarEtiqueta(tipo: string, codigo: string): ErrosDeCampos {
  const erros: ErrosDeCampos = {};
  if (tipo !== "qr_code" && tipo !== "rfid") erros["tipo"] = "Selecione o tipo da etiqueta.";
  if (!codigoDeEtiquetaValido(codigo)) erros["codigo"] = "Informe o código da etiqueta (1 a 128 caracteres, sem caracteres de controle).";
  return erros;
}

export function temErrosDeCampos(erros: ErrosDeCampos): boolean {
  return Object.keys(erros).length > 0;
}
