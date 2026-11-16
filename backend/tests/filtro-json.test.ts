import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lerFiltroJson } from "../src/filtro-json.ts";

const aninhar = (nivel: number, folha: unknown, abrir: (interno: unknown) => unknown): unknown => {
  let atual: unknown = folha;
  for (let i = 0; i < nivel; i++) atual = abrir(atual);
  return atual;
};

describe("filtro JSON: profundidade conta arrays e objetos e é verificada antes de recursar (G3)", () => {
  it("3 níveis de objeto passam e 4 níveis são recusados", () => {
    assert.ok(lerFiltroJson(JSON.stringify({ a: { b: { c: 1 } } })));
    assert.equal(lerFiltroJson(JSON.stringify({ a: { b: { c: { d: 1 } } } })), null);
  });

  it("arrays contam como nível: 3 níveis passam e 4 são recusados", () => {
    assert.ok(lerFiltroJson(JSON.stringify({ a: [[1]] })));
    assert.equal(lerFiltroJson(JSON.stringify({ a: [[[1]]] })), null);
    assert.ok(lerFiltroJson(JSON.stringify({ a: [1, 2, 3] })));
  });

  it("mistura de objetos e arrays soma os níveis", () => {
    assert.ok(lerFiltroJson(JSON.stringify({ a: [{ b: 1 }] })));
    assert.equal(lerFiltroJson(JSON.stringify({ a: [{ b: [1] }] })), null);
    assert.equal(lerFiltroJson(JSON.stringify({ a: { b: [{ c: 1 }] } })), null);
    assert.equal(lerFiltroJson(JSON.stringify({ a: [{ b: { c: 1 } }] })), null);
  });

  it("100 arrays aninhados são recusados sem estourar a pilha", () => {
    const profundo = aninhar(100, 1, (interno) => [interno]);
    const texto = JSON.stringify({ a: profundo });
    assert.ok(texto.length <= 512);
    assert.equal(lerFiltroJson(texto), null);
    assert.equal(lerFiltroJson(JSON.stringify({ a: aninhar(200, 1, (interno) => ({ k: interno })) })), null);
  });

  it("escalares, limites de tamanho e chaves proibidas continuam valendo", () => {
    assert.ok(lerFiltroJson('{"id_lote":5,"ativo":true,"x":null,"t":"texto"}'));
    assert.equal(lerFiltroJson("{}"), null);
    assert.equal(lerFiltroJson("[1]"), null);
    assert.equal(lerFiltroJson('{"senha_hash":"x"}'), null);
    assert.equal(lerFiltroJson('{"a":{"senha_hash":"x"}}'), null);
    assert.equal(lerFiltroJson('{"a":[{"senha_hash":"x"}]}'), null);
    assert.equal(lerFiltroJson(`{"a":"${"x".repeat(101)}"}`), null);
    assert.equal(lerFiltroJson(`{"a":[${Array.from({ length: 11 }, () => "1").join(",")}]}`), null);
  });
});
