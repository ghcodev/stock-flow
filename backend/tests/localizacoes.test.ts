import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { criarUsuarioTeste, desativarUsuariosTeste, subir, tokenDe, type Servidor } from "./helpers.ts";

type Localizacao = {
  id_localizacao: number;
  corredor: string;
  nivel: string;
  posicao: string;
  capacidade: string | null;
  descricao: string | null;
};
type Lista = { dados: Localizacao[]; pagina: number; limite: number; total: number };

describe("localizações (A6)", () => {
  const corredor = `T${randomUUID().slice(0, 8)}`;
  let servidor: Servidor;
  let operador: string;
  let admin: string;

  before(async () => {
    servidor = await subir(createApp());
    operador = await tokenDe(await criarUsuarioTeste("operador"));
    admin = await tokenDe(await criarUsuarioTeste("administrador"));
  });

  after(async () => {
    await servidor.fechar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("operador e administrador criam localização (201)", async () => {
    const a = await chamarApi(servidor, "POST", "/localizacoes", operador, {
      corredor,
      nivel: "1",
      posicao: "A",
      capacidade: 100.5,
      descricao: "Teste",
    });
    assert.equal(a.status, 201);
    const loc = a.corpo as Localizacao;
    assert.equal(loc.capacidade, "100.5");
    assert.equal(loc.corredor, corredor);
    assert.equal((await chamarApi(servidor, "POST", "/localizacoes", admin, { corredor, nivel: "1", posicao: "B" })).status, 201);
  });

  it("RN06: corredor, nível e posição não podem se repetir (409)", async () => {
    const dados = { corredor, nivel: "9", posicao: "Z" };
    assert.equal((await chamarApi(servidor, "POST", "/localizacoes", operador, dados)).status, 201);
    const r = await chamarApi(servidor, "POST", "/localizacoes", admin, dados);
    assert.equal(r.status, 409);
    assert.deepEqual(r.corpo, { erro: { codigo: "REGISTRO_DUPLICADO", mensagem: "Registro já existente" } });
    assert.doesNotMatch(r.texto, /localizacao_|unique|duplicate/i);
  });

  it("validação: 400 com campos e sem ecoar valores", async () => {
    const r = await chamarApi(servidor, "POST", "/localizacoes", operador, {
      corredor: "CORREDOR-LONGO-SEGREDO",
      nivel: "",
      capacidade: -1,
    });
    assert.equal(r.status, 400);
    const campos = (r.corpo as { erro: { campos: { campo: string }[] } }).erro.campos.map((c) => c.campo);
    assert.deepEqual(campos.sort(), ["capacidade", "corredor", "nivel", "posicao"]);
    assert.doesNotMatch(r.texto, /SEGREDO/);
  });

  it("sem token 401; DELETE e PATCH não existem", async () => {
    assert.equal((await chamarApi(servidor, "GET", "/localizacoes")).status, 401);
    assert.equal((await chamarApi(servidor, "POST", "/localizacoes", undefined, {})).status, 401);
    assert.equal((await chamarApi(servidor, "DELETE", "/localizacoes/1", admin)).status, 404);
    assert.equal((await chamarApi(servidor, "PATCH", "/localizacoes/1", admin, { nivel: "2" })).status, 404);
  });

  it("obter por id, 404 e 400", async () => {
    const criada = (await chamarApi(servidor, "POST", "/localizacoes", operador, { corredor, nivel: "3", posicao: "C" }))
      .corpo as Localizacao;
    const r = await chamarApi(servidor, "GET", `/localizacoes/${criada.id_localizacao}`, operador);
    assert.equal(r.status, 200);
    assert.equal((r.corpo as Localizacao).posicao, "C");
    assert.equal((await chamarApi(servidor, "GET", "/localizacoes/2000000000", operador)).status, 404);
    assert.equal((await chamarApi(servidor, "GET", "/localizacoes/x", operador)).status, 400);
  });

  it("listagem com busca e paginação", async () => {
    const lista = (await chamarApi(servidor, "GET", `/localizacoes?busca=${corredor}&limite=2&pagina=1`, operador))
      .corpo as Lista;
    assert.ok(lista.total >= 4);
    assert.equal(lista.dados.length, 2);
    assert.equal(lista.limite, 2);
    const ultima = (await chamarApi(servidor, "GET", `/localizacoes?busca=${corredor}&limite=2&pagina=2`, operador))
      .corpo as Lista;
    assert.ok(ultima.dados.length >= 1);
    assert.equal((await chamarApi(servidor, "GET", "/localizacoes?limite=500", operador)).status, 400);
  });

  describe("busca pelo rótulo combinado corredor-nível-posição (V1)", () => {
    const p = `V${randomUUID().slice(0, 6).toUpperCase()}`;
    const exato = `${p}-1-01`;
    const contido = `X${p}-1-01`;
    const buscar = async (consulta: string): Promise<Lista> => {
      const r = await chamarApi(servidor, "GET", `/localizacoes?${consulta}`, operador);
      assert.equal(r.status, 200, r.texto);
      return r.corpo as Lista;
    };

    before(async () => {
      for (const [c, n, po] of [[p, "1", "01"], [`X${p}`, "1", "01"], [p, "2", "07"], [p, "3", "50%"]] as const) {
        const r = await chamarApi(servidor, "POST", "/localizacoes", operador, { corredor: c, nivel: n, posicao: po });
        assert.equal(r.status, 201, r.texto);
      }
    });

    it("rótulo exato, parcial, em outra caixa e com espaços", async () => {
      assert.deepEqual((await buscar(`busca=${encodeURIComponent(exato)}`)).dados.map((l) => `${l.corredor}-${l.nivel}-${l.posicao}`), [exato, contido]);
      assert.equal((await buscar(`busca=${encodeURIComponent(exato.toLowerCase())}`)).total, 2);
      assert.equal((await buscar(`busca=${encodeURIComponent(`${p} 2 07`)}`)).total, 1);
      assert.equal((await buscar(`busca=${encodeURIComponent(`${p}-2`)}`)).total >= 1, true);
      assert.equal((await buscar(`busca=${encodeURIComponent(`${p}/2/07`)}`)).dados[0]?.posicao, "07");
    });

    it("o casamento exato do rótulo vem primeiro, antes do que apenas contém", async () => {
      const lista = await buscar(`busca=${encodeURIComponent(exato)}&limite=1`);
      assert.equal(lista.dados[0]?.corredor, p);
      assert.equal(lista.total, 2);
    });

    it("filtra no banco antes do limite e preserva paginação", async () => {
      const primeira = await buscar(`busca=${encodeURIComponent(exato)}&limite=1&pagina=1`);
      const segunda = await buscar(`busca=${encodeURIComponent(exato)}&limite=1&pagina=2`);
      assert.equal(primeira.dados.length, 1);
      assert.equal(segunda.dados.length, 1);
      assert.notEqual(primeira.dados[0]?.id_localizacao, segunda.dados[0]?.id_localizacao);
      assert.equal((await buscar(`busca=${encodeURIComponent(exato)}&limite=1&pagina=3`)).dados.length, 0);
    });

    it("%, _ e aspas são literais: não viram curinga nem quebram a consulta", async () => {
      assert.equal((await buscar(`busca=${encodeURIComponent(`${p}-%`)}`)).total, 0);
      assert.equal((await buscar(`busca=${encodeURIComponent(`${p}-_-01`)}`)).total, 0);
      assert.equal((await buscar(`busca=${encodeURIComponent(`${p}-3-50%`)}`)).total, 1);
      assert.equal((await buscar(`busca=${encodeURIComponent("'; DROP TABLE localizacao; --")}`)).total, 0);
      assert.equal((await buscar(`busca=${encodeURIComponent('"x"')}`)).total, 0);
    });

    it("NUL e parâmetro repetido são 400", async () => {
      for (const consulta of ["busca=%00", "busca=a%00b", "busca=a&busca=b"]) {
        assert.equal((await chamarApi(servidor, "GET", `/localizacoes?${consulta}`, operador)).status, 400, consulta);
      }
    });

    it("sem busca continua listando e a tabela existe depois das tentativas de injeção", async () => {
      assert.ok((await buscar("limite=5")).total >= 4);
    });
  });
});
