import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estadoInicialDoSeletor, opcaoEscolhivel, opcoesVigentes, reduzirSeletor, type AcaoDoSeletor, type EstadoDoSeletor, type OpcaoDeBusca } from "../src/util/seletorEstado.ts";

const op = (valor: string, rotulo = valor): OpcaoDeBusca => ({ valor, rotulo });

function aplicar(inicial: EstadoDoSeletor, ...acoes: AcaoDoSeletor[]): EstadoDoSeletor {
  return acoes.reduce(reduzirSeletor, inicial);
}

describe("estado do seletor com busca ligado à consulta vigente (U1)", () => {
  it("abrir e receber a resposta da consulta atual deixa a primeira opção escolhível", () => {
    let e = aplicar(estadoInicialDoSeletor(""), { tipo: "abrir", textoDaConsulta: "" });
    assert.equal(opcaoEscolhivel(e), null);
    e = aplicar(e, { tipo: "resposta", consulta: e.consulta, opcoes: [op("1", "A"), op("2", "B")] });
    assert.deepEqual(opcaoEscolhivel(e), op("1", "A"));
  });

  it("trocar o texto invalida na hora as opções e o índice: Enter antes da resposta não escolhe nada", () => {
    let e = aplicar(estadoInicialDoSeletor(""), { tipo: "abrir", textoDaConsulta: "" });
    e = aplicar(e, { tipo: "resposta", consulta: e.consulta, opcoes: [op("1", "Leite antigo")] });
    assert.deepEqual(opcaoEscolhivel(e), op("1", "Leite antigo"));
    e = aplicar(e, { tipo: "digitar", texto: "man" });
    assert.equal(e.ativa, -1);
    assert.deepEqual(opcoesVigentes(e), []);
    assert.equal(opcaoEscolhivel(e), null);
    assert.equal(opcaoEscolhivel(e, 0), null);
    assert.equal(e.situacao, "carregando");
  });

  it("depois da resposta da nova consulta, Enter escolhe a opção da nova consulta", () => {
    let e = aplicar(estadoInicialDoSeletor(""), { tipo: "abrir", textoDaConsulta: "" });
    e = aplicar(e, { tipo: "resposta", consulta: e.consulta, opcoes: [op("1", "Leite")] });
    e = aplicar(e, { tipo: "digitar", texto: "man" });
    e = aplicar(e, { tipo: "resposta", consulta: e.consulta, opcoes: [op("9", "Manteiga")] });
    assert.deepEqual(opcaoEscolhivel(e), op("9", "Manteiga"));
  });

  it("respostas invertidas: a resposta da consulta antiga chega depois e é ignorada", () => {
    let e = aplicar(estadoInicialDoSeletor(""), { tipo: "digitar", texto: "le" });
    const antiga = e.consulta;
    e = aplicar(e, { tipo: "digitar", texto: "lei" });
    const atual = e.consulta;
    e = aplicar(e, { tipo: "resposta", consulta: atual, opcoes: [op("2", "Leite")] });
    e = aplicar(e, { tipo: "resposta", consulta: antiga, opcoes: [op("1", "Lenha")] });
    assert.deepEqual(opcoesVigentes(e).map((o) => o.valor), ["2"]);
    assert.deepEqual(opcaoEscolhivel(e), op("2", "Leite"));
  });

  it("falha de consulta antiga não derruba a atual; falha da atual mostra erro sem opções", () => {
    let e = aplicar(estadoInicialDoSeletor(""), { tipo: "digitar", texto: "a" });
    const antiga = e.consulta;
    e = aplicar(e, { tipo: "digitar", texto: "ab" });
    e = aplicar(e, { tipo: "falha", consulta: antiga });
    assert.equal(e.situacao, "carregando");
    e = aplicar(e, { tipo: "falha", consulta: e.consulta });
    assert.equal(e.situacao, "erro");
    assert.equal(opcaoEscolhivel(e), null);
  });

  it("setas só andam sobre opções da consulta vigente e dão a volta", () => {
    let e = aplicar(estadoInicialDoSeletor(""), { tipo: "abrir", textoDaConsulta: "" });
    e = aplicar(e, { tipo: "mover", delta: 1 });
    assert.equal(e.ativa, -1);
    e = aplicar(e, { tipo: "resposta", consulta: e.consulta, opcoes: [op("1"), op("2"), op("3")] });
    e = aplicar(e, { tipo: "mover", delta: -1 });
    assert.equal(e.ativa, 2);
    e = aplicar(e, { tipo: "mover", delta: 1 });
    assert.equal(e.ativa, 0);
    e = aplicar(e, { tipo: "apontar", indice: 1 });
    assert.equal(e.ativa, 1);
    e = aplicar(e, { tipo: "digitar", texto: "x" });
    e = aplicar(e, { tipo: "apontar", indice: 1 });
    assert.equal(e.ativa, -1);
  });

  it("fechada, a lista não é escolhível; definir texto (escolha ou limpeza) invalida a consulta", () => {
    let e = aplicar(estadoInicialDoSeletor(""), { tipo: "abrir", textoDaConsulta: "" });
    e = aplicar(e, { tipo: "resposta", consulta: e.consulta, opcoes: [op("1")] });
    e = aplicar(e, { tipo: "fechar" });
    assert.equal(opcaoEscolhivel(e), null);
    const antes = e.consulta;
    e = aplicar(e, { tipo: "definirTexto", texto: "Escolhido" });
    assert.equal(e.texto, "Escolhido");
    assert.ok(e.consulta > antes);
    e = aplicar(e, { tipo: "resposta", consulta: antes, opcoes: [op("7")] });
    assert.deepEqual(opcoesVigentes(e), []);
  });
});
