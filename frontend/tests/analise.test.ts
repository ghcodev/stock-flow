import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FILTROS_DE_AUDITORIA_VAZIOS,
  chaveDosFiltros,
  chavesAlteradas,
  consultaDeAuditoria,
  ipValido,
  textoDoJson,
  validarFiltroJson,
  validarFiltrosDeAuditoria,
  validarPeriodo,
} from "../src/util/auditoria.ts";
import { listaInicial, reduzirLista, type EstadoDeLista } from "../src/util/cursor.ts";
import { montarConsulta } from "../src/api/cliente.ts";

describe("filtro JSON da auditoria com os mesmos limites do backend", () => {
  it("vazio é aceito; objeto simples é aceito", () => {
    assert.equal(validarFiltroJson(""), null);
    assert.equal(validarFiltroJson("   "), null);
    assert.equal(validarFiltroJson('{"status_lote":"bloqueado"}'), null);
    assert.equal(validarFiltroJson('{"a":{"b":{"c":1}},"l":[1,2,3],"n":null,"t":true}'), null);
  });

  it("recusa não objeto, vazio, JSON inválido, texto grande, NUL, chaves e profundidade fora do limite", () => {
    for (const ruim of ["abc", "[1]", "1", "null", "{}", '{"a":', `{"a":"${"x".repeat(101)}"}`, "{\"a\":\"x\\u0000\"}", '{"senha_hash":"x"}', '{"a":{"senha_hash":1}}', '{"__proto__":1}', '{"constructor":1}', `{"${"k".repeat(51)}":1}`, '{"":1}', '{"a":{"b":{"c":{"d":{"e":1}}}}}', `{"l":[${Array.from({ length: 11 }, () => "1").join(",")}]}`, JSON.stringify(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]))), `{"a":"${"x".repeat(520)}"}`]) {
      assert.notEqual(validarFiltroJson(ruim), null, ruim.slice(0, 40));
    }
  });

  it("20 chaves ainda valem e 21 não", () => {
    const com = (n: number) => JSON.stringify(Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, i])));
    assert.equal(validarFiltroJson(com(20)), null);
    assert.notEqual(validarFiltroJson(com(21)), null);
  });
});

describe("IP, período e filtros de auditoria", () => {
  it("IPv4 e IPv6 válidos; lixo, NUL e tamanho excessivo recusados", () => {
    for (const bom of ["127.0.0.1", "10.0.0.255", "::1", "2001:db8::1", "fe80::1ff:fe23:4567:890a"]) assert.equal(ipValido(bom), true, bom);
    for (const ruim of ["", "256.1.1.1", "1.2.3", "01.2.3.4", "abc", "::g", "1.2.3.4\u0000", "a".repeat(46), "1:2:3:4:5:6:7:8:9", "http://x", "1.2.3.4/24"]) assert.equal(ipValido(ruim), false, ruim);
  });

  it("período: datas reais e início não posterior ao fim", () => {
    assert.deepEqual(validarPeriodo("", ""), {});
    assert.deepEqual(validarPeriodo("2026-11-01", "2026-11-01"), {});
    assert.ok(validarPeriodo("2026-02-30", "").de);
    assert.ok(validarPeriodo("", "xx").ate);
    assert.ok(validarPeriodo("2026-11-02", "2026-11-01").ate);
  });

  it("filtros: erros por campo e consulta só com o que foi preenchido, no formato que a API aceita", () => {
    assert.deepEqual(validarFiltrosDeAuditoria(FILTROS_DE_AUDITORIA_VAZIOS), {});
    const ruins = validarFiltrosDeAuditoria({ ...FILTROS_DE_AUDITORIA_VAZIOS, idUsuario: "abc", ip: "x", de: "2026-13-01", valorNovo: "{" });
    assert.deepEqual(Object.keys(ruins).sort(), ["de", "idUsuario", "ip", "valorNovo"]);
    const consulta = consultaDeAuditoria({ idUsuario: "7", tabela: "lote", operacao: "UPDATE", ip: " 10.0.0.1 ", de: "2026-11-01", ate: "2026-11-16", valorNovo: ' {"status_lote":"bloqueado"} ', valorAnterior: "" });
    assert.equal(
      montarConsulta({ ...consulta, limite: 50 }),
      "?id_usuario=7&tabela=lote&operacao=UPDATE&ip=10.0.0.1&de=2026-11-01&ate=2026-11-16&valor_novo=%7B%22status_lote%22%3A%22bloqueado%22%7D&limite=50",
    );
  });

  it("a chave dos filtros ignora vazios e a ordem", () => {
    assert.equal(chaveDosFiltros({ b: 1, a: "x", c: "", d: undefined }), chaveDosFiltros({ a: "x", b: 1 }));
    assert.notEqual(chaveDosFiltros({ a: "x" }), chaveDosFiltros({ a: "y" }));
  });

  it("diferenças por chave e texto do JSON sem HTML", () => {
    assert.deepEqual(chavesAlteradas({ a: 1, b: 2, c: 3 }, { a: 1, b: 5, d: 4 }), ["b", "c", "d"]);
    assert.deepEqual(chavesAlteradas(null, { a: 1 }), ["a"]);
    assert.deepEqual(chavesAlteradas({ a: [1, 2] }, { a: [1, 2] }), []);
    assert.equal(textoDoJson(null), "—");
    assert.equal(textoDoJson({ nome: "<img src=x onerror=alert(1)>" }), '{\n  "nome": "<img src=x onerror=alert(1)>"\n}');
  });
});

describe("lista com cursor: filtro novo reinicia e respostas velhas são ignoradas", () => {
  type E = EstadoDeLista<number>;
  const aplicar = (e: E, ...acoes: Parameters<typeof reduzirLista<number>>[1][]): E => acoes.reduce((s, a) => reduzirLista(s, a), e);

  it("carregar mais anexa, mantém o total da primeira página e para quando não há próximo cursor", () => {
    let e = aplicar(listaInicial<number>(), { tipo: "iniciar", chave: "A#0" });
    e = aplicar(e, { tipo: "sucesso", chave: "A#0", dados: [3, 2, 1], proximo: "1", total: 6, anexar: false });
    assert.deepEqual([e.itens, e.proximo, e.total], [[3, 2, 1], "1", 6]);
    e = aplicar(e, { tipo: "carregarMais", chave: "A#0" });
    assert.equal(e.carregando, true);
    e = aplicar(e, { tipo: "sucesso", chave: "A#0", dados: [0, -1], proximo: null, total: 3, anexar: true });
    assert.deepEqual([e.itens, e.proximo, e.total], [[3, 2, 1, 0, -1], null, 6]);
    assert.equal(aplicar(e, { tipo: "carregarMais", chave: "A#0" }), e);
  });

  it("trocar o filtro zera itens e cursor; resposta do filtro antigo não entra", () => {
    let e = aplicar(listaInicial<number>(), { tipo: "iniciar", chave: "A#0" }, { tipo: "sucesso", chave: "A#0", dados: [1], proximo: "x", total: 9, anexar: false });
    e = aplicar(e, { tipo: "iniciar", chave: "B#0" });
    assert.deepEqual([e.itens, e.proximo, e.total, e.carregando], [[], null, null, true]);
    e = aplicar(e, { tipo: "sucesso", chave: "A#0", dados: [99], proximo: "y", total: 1, anexar: false });
    assert.deepEqual(e.itens, []);
    e = aplicar(e, { tipo: "falha", chave: "A#0", mensagem: "velha" });
    assert.equal(e.erro, null);
    e = aplicar(e, { tipo: "sucesso", chave: "B#0", dados: [5], proximo: null, total: 1, anexar: false });
    assert.deepEqual(e.itens, [5]);
  });

  it("carregar mais enquanto carrega é ignorado; falha mantém o que já havia e permite tentar de novo", () => {
    let e = aplicar(listaInicial<number>(), { tipo: "iniciar", chave: "A#0" }, { tipo: "sucesso", chave: "A#0", dados: [1], proximo: "c", total: 2, anexar: false });
    e = aplicar(e, { tipo: "carregarMais", chave: "A#0" });
    const duplicado = aplicar(e, { tipo: "carregarMais", chave: "A#0" });
    assert.equal(duplicado, e);
    e = aplicar(e, { tipo: "falha", chave: "A#0", mensagem: "Sem conexão" });
    assert.deepEqual([e.itens, e.erro, e.carregando, e.proximo], [[1], "Sem conexão", false, "c"]);
    e = aplicar(e, { tipo: "carregarMais", chave: "A#0" });
    assert.equal(e.erro, null);
  });

  it("recarregar (mesma chave com versão nova) também reinicia", () => {
    let e = aplicar(listaInicial<number>(), { tipo: "iniciar", chave: "A#0" }, { tipo: "sucesso", chave: "A#0", dados: [1, 2], proximo: null, total: 2, anexar: false });
    e = aplicar(e, { tipo: "iniciar", chave: "A#1" });
    assert.deepEqual(e.itens, []);
    e = aplicar(e, { tipo: "sucesso", chave: "A#0", dados: [7], proximo: null, total: 1, anexar: false });
    assert.deepEqual(e.itens, []);
  });
});
