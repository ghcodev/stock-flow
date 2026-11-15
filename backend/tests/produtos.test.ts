import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { criarUsuarioTeste, desativarUsuariosTeste, subir, tokenDe, type Servidor } from "./helpers.ts";

type Produto = {
  id_produto: number;
  nome: string;
  categoria: string | null;
  unidade_medida: string;
  estoque_minimo: string;
  ativo: boolean;
};
type ListaProdutos = { dados: Produto[]; pagina: number; limite: number; total: number };

describe("produtos (A5)", () => {
  const prefixo = `Prod-${randomUUID()}`;
  let servidor: Servidor;
  let operador: string;
  let admin: string;

  const criar = (token: string, extra: Record<string, unknown> = {}) =>
    chamarApi(servidor, "POST", "/produtos", token, {
      nome: `${prefixo}-${randomUUID().slice(0, 8)}`,
      unidade_medida: "UN",
      ...extra,
    });

  before(async () => {
    servidor = await subir(createApp());
    operador = await tokenDe(await criarUsuarioTeste("operador"));
    admin = await tokenDe(await criarUsuarioTeste("administrador"));
  });

  after(async () => {
    await servidor.fechar();
    await prisma.produto.updateMany({ where: { nome: { startsWith: prefixo } }, data: { ativo: false } });
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("operador e administrador criam produto (201) com estoque mínimo em texto", async () => {
    for (const token of [operador, admin]) {
      const r = await criar(token, { categoria: "Cat", descricao: "Desc", estoque_minimo: 5.5 });
      assert.equal(r.status, 201);
      const p = r.corpo as Produto;
      assert.equal(p.ativo, true);
      assert.equal(p.estoque_minimo, "5.5");
      assert.equal(p.categoria, "Cat");
      assert.equal(typeof p.id_produto, "number");
    }
  });

  it("estoque mínimo padrão é 0 e campos desconhecidos são ignorados", async () => {
    const r = await criar(operador, { ativo: false, id_produto: 1, created_at: "2000-01-01", peso_unitario_kg: 9 });
    assert.equal(r.status, 201);
    const p = r.corpo as Produto;
    assert.equal(p.ativo, true);
    assert.notEqual(p.id_produto, 1);
    assert.equal(p.estoque_minimo, "0");
    assert.ok(!("peso_unitario_kg" in p));
  });

  it("sem token 401", async () => {
    assert.equal((await chamarApi(servidor, "GET", "/produtos")).status, 401);
    assert.equal((await chamarApi(servidor, "POST", "/produtos", undefined, {})).status, 401);
  });

  it("validação: 400 com campos e sem ecoar valores", async () => {
    const r = await chamarApi(servidor, "POST", "/produtos", operador, {
      nome: "",
      unidade_medida: "UNIDADE-MUITO-LONGA-SEGREDO",
      estoque_minimo: -3,
    });
    assert.equal(r.status, 400);
    const campos = (r.corpo as { erro: { campos: { campo: string }[] } }).erro.campos.map((c) => c.campo);
    assert.deepEqual(campos.sort(), ["estoque_minimo", "nome", "unidade_medida"]);
    assert.doesNotMatch(r.texto, /SEGREDO/);
    assert.equal((await criar(operador, { estoque_minimo: "1e3" })).status, 400);
    assert.equal((await criar(operador, { estoque_minimo: 1.2345 })).status, 400);
    assert.equal((await criar(operador, { nome: ["x"] })).status, 400);
  });

  it("obter por id, id inexistente 404 e id inválido 400", async () => {
    const criado = (await criar(operador)).corpo as Produto;
    const r = await chamarApi(servidor, "GET", `/produtos/${criado.id_produto}`, operador);
    assert.equal(r.status, 200);
    assert.equal((r.corpo as Produto).nome, criado.nome);
    assert.equal((await chamarApi(servidor, "GET", "/produtos/2000000000", operador)).status, 404);
    assert.equal((await chamarApi(servidor, "GET", "/produtos/abc", operador)).status, 400);
    assert.equal((await chamarApi(servidor, "GET", "/produtos/0", operador)).status, 400);
  });

  it("editar altera só o informado; corpo vazio 400; inexistente 404", async () => {
    const criado = (await criar(operador, { categoria: "A" })).corpo as Produto;
    const r = await chamarApi(servidor, "PATCH", `/produtos/${criado.id_produto}`, admin, {
      unidade_medida: "KG",
      categoria: null,
      ativo: false,
    });
    assert.equal(r.status, 200);
    const p = r.corpo as Produto;
    assert.equal(p.unidade_medida, "KG");
    assert.equal(p.categoria, null);
    assert.equal(p.nome, criado.nome);
    assert.equal(p.ativo, true);
    assert.equal((await chamarApi(servidor, "PATCH", `/produtos/${criado.id_produto}`, admin, {})).status, 400);
    assert.equal((await chamarApi(servidor, "PATCH", "/produtos/2000000000", admin, { nome: "x" })).status, 404);
  });

  it("inativar é exclusão lógica (RN01): o produto continua existindo", async () => {
    const criado = (await criar(operador)).corpo as Produto;
    const r = await chamarApi(servidor, "POST", `/produtos/${criado.id_produto}/inativar`, operador);
    assert.equal(r.status, 200);
    assert.equal((r.corpo as Produto).ativo, false);
    const depois = await chamarApi(servidor, "GET", `/produtos/${criado.id_produto}`, operador);
    assert.equal((depois.corpo as Produto).ativo, false);
    assert.equal((await chamarApi(servidor, "POST", `/produtos/${criado.id_produto}/inativar`, operador)).status, 200);
    assert.equal((await chamarApi(servidor, "POST", "/produtos/2000000000/inativar", operador)).status, 404);
    assert.equal(await prisma.produto.count({ where: { id_produto: criado.id_produto } }), 1);
  });

  it("não existe rota DELETE", async () => {
    const criado = (await criar(operador)).corpo as Produto;
    assert.equal((await chamarApi(servidor, "DELETE", `/produtos/${criado.id_produto}`, admin)).status, 404);
    assert.equal(await prisma.produto.count({ where: { id_produto: criado.id_produto } }), 1);
  });

  it("listagem com busca, filtro ativo, paginação e limite máximo", async () => {
    const busca = `Lista-${randomUUID().slice(0, 8)}`;
    for (let i = 0; i < 3; i++) {
      const r = await chamarApi(servidor, "POST", "/produtos", operador, {
        nome: `${prefixo}-${busca}-${i}`,
        unidade_medida: "UN",
      });
      assert.equal(r.status, 201);
    }
    const primeira = await chamarApi(servidor, "GET", `/produtos?busca=${busca.toLowerCase()}&limite=2&pagina=1`, operador);
    const lista = primeira.corpo as ListaProdutos;
    assert.equal(lista.total, 3);
    assert.equal(lista.limite, 2);
    assert.equal(lista.dados.length, 2);
    const segunda = (await chamarApi(servidor, "GET", `/produtos?busca=${busca}&limite=2&pagina=2`, operador))
      .corpo as ListaProdutos;
    assert.equal(segunda.dados.length, 1);
    await chamarApi(servidor, "POST", `/produtos/${lista.dados[0]?.id_produto}/inativar`, operador);
    const ativos = (await chamarApi(servidor, "GET", `/produtos?busca=${busca}&ativo=true`, operador))
      .corpo as ListaProdutos;
    assert.equal(ativos.total, 2);
    assert.equal((await chamarApi(servidor, "GET", "/produtos?limite=101", operador)).status, 400);
    assert.equal((await chamarApi(servidor, "GET", "/produtos?pagina=0", operador)).status, 400);
    assert.equal((await chamarApi(servidor, "GET", "/produtos?ativo=talvez", operador)).status, 400);
    const padrao = (await chamarApi(servidor, "GET", "/produtos", operador)).corpo as ListaProdutos;
    assert.equal(padrao.limite, 20);
  });
});
