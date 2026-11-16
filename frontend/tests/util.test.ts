import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compararDecimais, ehDecimalValido, ehZero, formatarQuantidade } from "../src/util/decimal.ts";
import { compararDias, diaDeHoje, diasAte, ehDiaValido, formatarDia } from "../src/util/datas.ts";
import { compararTexto, ordenarLinhas, proximaOrdenacao } from "../src/util/ordenacao.ts";
import {
  codigoDeEtiquetaValido,
  decimalValido,
  interpretarFalhaDeFormulario,
  normalizarDecimal,
  validarEtiqueta,
  validarLote,
  validarMotivo,
  validarProduto,
  type ValoresDeLote,
} from "../src/util/formularios.ts";
import { corpoDeProduto } from "../src/api/produtos.ts";
import { corpoDeLote } from "../src/api/lotes.ts";
import { ErroDaApi, ErroDeRede } from "../src/api/erros.ts";

describe("decimais em texto, sem ponto flutuante", () => {
  it("formata com milhar e vírgula, tirando zeros finais", () => {
    assert.equal(formatarQuantidade("0"), "0");
    assert.equal(formatarQuantidade("1234.500"), "1.234,5");
    assert.equal(formatarQuantidade("999999999.999"), "999.999.999,999");
    assert.equal(formatarQuantidade("10.000"), "10");
    assert.equal(formatarQuantidade("0.001"), "0,001");
    assert.equal(formatarQuantidade("-2"), "-2");
    assert.equal(formatarQuantidade("-0.000"), "0");
    assert.equal(formatarQuantidade("abc"), "abc");
  });

  it("não perde precisão onde o ponto flutuante perderia", () => {
    assert.equal(formatarQuantidade("123456789012345678901234567890.123"), "123.456.789.012.345.678.901.234.567.890,123");
    assert.equal(compararDecimais("0.1", "0.10"), 0);
    assert.equal(compararDecimais("9007199254740993", "9007199254740992"), 1);
    assert.equal(compararDecimais("0.30000000000000004", "0.3"), 1);
  });

  it("compara com sinal, casas diferentes e valores inválidos", () => {
    assert.equal(compararDecimais("2", "10"), -1);
    assert.equal(compararDecimais("-1", "1"), -1);
    assert.equal(compararDecimais("-1.5", "-1.25"), -1);
    assert.equal(compararDecimais("1.5", "1.50"), 0);
    assert.equal(ehZero("0.000"), true);
    assert.equal(ehZero("0.001"), false);
    assert.equal(ehDecimalValido("1.5"), true);
    assert.equal(ehDecimalValido("1,5"), false);
  });
});

describe("datas sem fuso", () => {
  it("formata AAAA-MM-DD sem deslocar o dia, em qualquer fuso", () => {
    assert.equal(formatarDia("2026-05-29"), "29/05/2026");
    assert.equal(formatarDia("2026-01-01"), "01/01/2026");
    assert.equal(formatarDia(null), "—");
    assert.equal(formatarDia("lixo"), "lixo");
  });

  it("valida dia real e calcula diferença em dias", () => {
    assert.equal(ehDiaValido("2026-02-28"), true);
    assert.equal(ehDiaValido("2026-02-30"), false);
    assert.equal(ehDiaValido("2026-13-01"), false);
    assert.equal(ehDiaValido("26-01-01"), false);
    assert.equal(diasAte("2026-05-29", "2026-05-27"), 2);
    assert.equal(diasAte("2026-05-27", "2026-05-29"), -2);
    assert.equal(diasAte("2026-03-01", "2026-02-28"), 1);
    assert.equal(diasAte("x", "2026-05-27"), null);
    assert.equal(diaDeHoje(new Date(2026, 10, 5)), "2026-11-05");
  });

  it("ordena dias com nulos por último", () => {
    assert.deepEqual(["2026-05-02", null, "2026-04-01"].sort(compararDias), ["2026-04-01", "2026-05-02", null]);
  });
});

describe("ordenação da página carregada", () => {
  it("alterna asc, desc e sem ordem", () => {
    const a = proximaOrdenacao(null, "nome");
    assert.deepEqual(a, { coluna: "nome", direcao: "asc" });
    const b = proximaOrdenacao(a, "nome");
    assert.deepEqual(b, { coluna: "nome", direcao: "desc" });
    assert.equal(proximaOrdenacao(b, "nome"), null);
    assert.deepEqual(proximaOrdenacao(b, "outra"), { coluna: "outra", direcao: "asc" });
  });

  it("é estável, não altera a entrada e trata acentos e números no texto", () => {
    const linhas = [{ n: "b", i: 1 }, { n: "a", i: 2 }, { n: "b", i: 3 }, { n: "a", i: 4 }];
    const original = [...linhas];
    const asc = ordenarLinhas(linhas, (x, y) => compararTexto(x.n, y.n), "asc");
    assert.deepEqual(asc.map((l) => l.i), [2, 4, 1, 3]);
    assert.deepEqual(ordenarLinhas(linhas, (x, y) => compararTexto(x.n, y.n), "desc").map((l) => l.i), [1, 3, 2, 4]);
    assert.deepEqual(linhas, original);
    assert.deepEqual(ordenarLinhas(linhas, null, "asc"), original);
    assert.deepEqual(["L10", "L2", "Á", "a", null].sort(compararTexto), ["Á", "a", "L2", "L10", null]);
  });
});

describe("validação de formulários", () => {
  it("normaliza vírgula e valida NUMERIC(12,3) não negativo", () => {
    assert.equal(normalizarDecimal(" 1,5 "), "1.5");
    for (const bom of ["0", "10", "1,5", "999999999.999", "0.001"]) assert.equal(decimalValido(bom), true, bom);
    for (const ruim of ["", "-1", "1.5555", "1000000000", "1e3", "abc", "1,5,5", "1.", ".5"]) assert.equal(decimalValido(ruim), false, ruim);
  });

  it("produto: campos obrigatórios, limites e estoque mínimo", () => {
    const base = { nome: "Farinha", categoria: "", descricao: "", unidade_medida: "kg", estoque_minimo: "" };
    assert.deepEqual(validarProduto(base), {});
    assert.ok(validarProduto({ ...base, nome: "  " })["nome"]);
    assert.ok(validarProduto({ ...base, nome: "x".repeat(121) })["nome"]);
    assert.ok(validarProduto({ ...base, unidade_medida: "" })["unidade_medida"]);
    assert.ok(validarProduto({ ...base, unidade_medida: "x".repeat(11) })["unidade_medida"]);
    assert.ok(validarProduto({ ...base, categoria: "x".repeat(61) })["categoria"]);
    assert.ok(validarProduto({ ...base, estoque_minimo: "-1" })["estoque_minimo"]);
  });

  const lote: ValoresDeLote = {
    numero_lote: "L-1",
    id_produto: "3",
    id_localizacao: "2",
    quantidade: "",
    data_fabricacao: "",
    data_validade: "",
    etiqueta_tipo: "",
    etiqueta_codigo: "",
  };

  it("lote: obrigatórios, datas reais, validade não anterior e etiqueta completa", () => {
    assert.deepEqual(validarLote(lote), {});
    assert.ok(validarLote({ ...lote, numero_lote: "" })["numero_lote"]);
    assert.ok(validarLote({ ...lote, id_produto: "" })["id_produto"]);
    assert.ok(validarLote({ ...lote, id_localizacao: "" })["id_localizacao"]);
    assert.ok(validarLote({ ...lote, quantidade: "1.2345" })["quantidade"]);
    assert.ok(validarLote({ ...lote, data_validade: "2026-02-30" })["data_validade"]);
    assert.ok(validarLote({ ...lote, data_fabricacao: "2026-05-10", data_validade: "2026-05-09" })["data_validade"]);
    assert.deepEqual(validarLote({ ...lote, data_fabricacao: "2026-05-10", data_validade: "2026-05-10" }), {});
    assert.ok(validarLote({ ...lote, etiqueta_codigo: "ABC" })["etiqueta_tipo"]);
    assert.ok(validarLote({ ...lote, etiqueta_tipo: "qr_code" })["etiqueta_codigo"]);
    assert.deepEqual(validarLote({ ...lote, etiqueta_tipo: "rfid", etiqueta_codigo: "E200" }), {});
  });

  it("código de etiqueta: 1 a 128 caracteres sem controle", () => {
    assert.equal(codigoDeEtiquetaValido("QR-123"), true);
    assert.equal(codigoDeEtiquetaValido("  QR-123  "), true);
    assert.equal(codigoDeEtiquetaValido("x".repeat(128)), true);
    for (const ruim of ["", "   ", "x".repeat(129), "a\nb", "a\u0000b", "a\tb", "a\u007fb"]) assert.equal(codigoDeEtiquetaValido(ruim), false, JSON.stringify(ruim));
    assert.deepEqual(validarEtiqueta("qr_code", "A1"), {});
    assert.ok(validarEtiqueta("barras", "A1")["tipo"]);
    assert.ok(validarEtiqueta("rfid", "")["codigo"]);
  });

  it("motivo do bloqueio é obrigatório e limitado a 500", () => {
    assert.equal(validarMotivo("Avaria"), null);
    assert.ok(validarMotivo("   "));
    assert.ok(validarMotivo("x".repeat(501)));
  });
});

describe("falhas da API em formulário", () => {
  it("400 mapeia campos; 409 e 422 viram mensagem geral; rede vira mensagem fixa", () => {
    const campos = interpretarFalhaDeFormulario(new ErroDaApi(400, "VALIDACAO", "Dados inválidos", [{ campo: "nome", mensagem: "Nome é obrigatório" }]));
    assert.deepEqual(campos, { geral: null, campos: { nome: "Nome é obrigatório" } });
    assert.deepEqual(interpretarFalhaDeFormulario(new ErroDaApi(409, "REGISTRO_DUPLICADO", "Registro já existente")), { geral: "Registro já existente", campos: {} });
    assert.deepEqual(interpretarFalhaDeFormulario(new ErroDaApi(422, "PRODUTO_INATIVO", "Produto inativo não pode receber lotes")), {
      geral: "Produto inativo não pode receber lotes",
      campos: {},
    });
    assert.match(interpretarFalhaDeFormulario(new ErroDeRede("SEM_CONEXAO", "x")).geral ?? "", /Sem conexão/);
    assert.doesNotMatch(interpretarFalhaDeFormulario(new ErroDaApi(500, "ERRO_INTERNO", "TypeError at /app")).geral ?? "", /TypeError|\/app/);
  });
});

describe("corpos enviados à API", () => {
  const valores = { nome: "  Farinha ", categoria: " ", descricao: "", unidade_medida: " kg ", estoque_minimo: "1,5" };

  it("produto novo omite opcionais vazios e normaliza o decimal", () => {
    assert.deepEqual(corpoDeProduto(valores, "criar"), { nome: "Farinha", unidade_medida: "kg", estoque_minimo: "1.5" });
    assert.deepEqual(corpoDeProduto({ ...valores, categoria: "Secos", estoque_minimo: "" }, "criar"), { nome: "Farinha", unidade_medida: "kg", categoria: "Secos" });
  });

  it("produto editado manda null para limpar e zero para estoque mínimo vazio", () => {
    assert.deepEqual(corpoDeProduto({ ...valores, estoque_minimo: "" }, "editar"), {
      nome: "Farinha",
      unidade_medida: "kg",
      categoria: null,
      descricao: null,
      estoque_minimo: "0",
    });
  });

  it("lote converte ids e omite o que está vazio; quantidade segue como texto", () => {
    const corpo = corpoDeLote({
      numero_lote: " L-1 ",
      id_produto: "3",
      id_localizacao: "2",
      quantidade: "10,500",
      data_fabricacao: "",
      data_validade: "2026-12-31",
      etiqueta_tipo: "qr_code",
      etiqueta_codigo: " QR-1 ",
    });
    assert.deepEqual(corpo, {
      numero_lote: "L-1",
      id_produto: 3,
      id_localizacao: 2,
      quantidade: "10.500",
      data_validade: "2026-12-31",
      etiqueta: { tipo: "qr_code", codigo: "QR-1" },
    });
  });
});

describe("janela e limites da paginação", () => {
  it("mostra até cinco páginas em torno da atual, sem passar dos extremos", async () => {
    const { janelaDePaginas, limitesDaPagina, ultimaPagina } = await import("../src/util/paginacao.ts");
    assert.deepEqual(janelaDePaginas(1, 1), [1]);
    assert.deepEqual(janelaDePaginas(1, 10), [1, 2, 3, 4, 5]);
    assert.deepEqual(janelaDePaginas(5, 10), [3, 4, 5, 6, 7]);
    assert.deepEqual(janelaDePaginas(10, 10), [6, 7, 8, 9, 10]);
    assert.deepEqual(janelaDePaginas(2, 3), [1, 2, 3]);
    assert.equal(ultimaPagina(0, 20), 1);
    assert.equal(ultimaPagina(41, 20), 3);
    assert.deepEqual(limitesDaPagina(1, 20, 0), { primeiro: 0, ultimo: 0 });
    assert.deepEqual(limitesDaPagina(3, 20, 41), { primeiro: 41, ultimo: 41 });
    assert.deepEqual(limitesDaPagina(1, 20, 135), { primeiro: 1, ultimo: 20 });
  });
});

describe("apresentação de lotes", () => {
  it("rotula a localização e descreve a validade a partir de uma data de referência", async () => {
    const { rotuloDaLocalizacao, situacaoDeValidade } = await import("../src/paginas/lotes/apresentacao.ts");
    assert.equal(rotuloDaLocalizacao({ corredor: "A", nivel: "2", posicao: "07" }), "A-2-07");
    const base = { status_lote: "ativo" as const };
    assert.equal(situacaoDeValidade({ ...base, data_validade: null }, "2026-05-27"), null);
    assert.deepEqual(situacaoDeValidade({ ...base, data_validade: "2026-05-27" }, "2026-05-27"), { texto: "vence hoje", tom: "alerta" });
    assert.deepEqual(situacaoDeValidade({ ...base, data_validade: "2026-05-28" }, "2026-05-27"), { texto: "vence em 1 dia", tom: "alerta" });
    assert.deepEqual(situacaoDeValidade({ ...base, data_validade: "2026-06-26" }, "2026-05-27"), { texto: "vence em 30 dias", tom: "alerta" });
    assert.equal(situacaoDeValidade({ ...base, data_validade: "2026-06-27" }, "2026-05-27"), null);
    assert.deepEqual(situacaoDeValidade({ ...base, data_validade: "2026-05-26" }, "2026-05-27"), { texto: "venceu há 1 dia", tom: "perigo" });
    assert.deepEqual(situacaoDeValidade({ status_lote: "vencido", data_validade: "2026-05-20" }, "2026-05-27"), { texto: "venceu há 7 dias", tom: "perigo" });
    assert.equal(situacaoDeValidade({ status_lote: "bloqueado", data_validade: "2026-05-28" }, "2026-05-27"), null);
  });
});
