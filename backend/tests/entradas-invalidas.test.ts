import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { criarUsuarioTeste, desativarUsuariosTeste, subir, tokenDe, type Servidor } from "./helpers.ts";

const NAO_ESCALARES: unknown[] = [["a"], ["1", "2"], { a: 1 }, [], [[1]], [{ a: 1 }]];

function corposComCampoInvalido(base: Record<string, unknown>, campos: string[]): Record<string, unknown>[] {
  return campos.flatMap((campo) => NAO_ESCALARES.map((valor) => ({ ...base, [campo]: valor })));
}

describe("entradas não escalares e parâmetros repetidos viram 400, nunca 500", () => {
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

  it("consultas com parâmetro repetido ou em formato de objeto", async () => {
    const consultas = [
      "/produtos?limite=1&limite=2",
      "/produtos?pagina=1&pagina=2",
      "/produtos?ativo=true&ativo=false",
      "/produtos?busca=a&busca=b",
      "/localizacoes?limite=1&limite=2",
      "/localizacoes?pagina=1&pagina=2",
      "/localizacoes?busca=a&busca=b",
      "/lotes?status=ativo&status=bloqueado",
      "/lotes?id_produto=1&id_produto=2",
      "/lotes?id_localizacao=1&id_localizacao=2",
      "/lotes?numero_lote=a&numero_lote=b",
      "/lotes?limite=1&limite=2",
      "/lotes?pagina=1&pagina=2",
      "/usuarios?perfil=operador&perfil=administrador",
      "/usuarios?ativo=true&ativo=false",
      "/usuarios?busca=a&busca=b",
      "/usuarios?limite=1&limite=2",
      "/usuarios?pagina=1&pagina=2",
    ];
    for (const consulta of consultas) {
      const r = await chamarApi(servidor, "GET", consulta, admin);
      assert.equal(r.status, 400, consulta);
    }
  });

  it("corpos com arrays e objetos em produtos, localizações e lotes", async () => {
    const casos: [string, string, Record<string, unknown>][] = [];
    const produto = { nome: "N", unidade_medida: "UN" };
    for (const c of corposComCampoInvalido(produto, ["nome", "unidade_medida", "categoria", "descricao", "estoque_minimo"])) {
      casos.push(["POST", "/produtos", c]);
      casos.push(["PATCH", "/produtos/1", c]);
    }
    const local = { corredor: "C", nivel: "1", posicao: "A" };
    for (const c of corposComCampoInvalido(local, ["corredor", "nivel", "posicao", "descricao", "capacidade"])) {
      casos.push(["POST", "/localizacoes", c]);
    }
    const lote = { numero_lote: "L", id_produto: 1, id_localizacao: 1 };
    for (const c of corposComCampoInvalido(lote, [
      "numero_lote",
      "id_produto",
      "id_localizacao",
      "quantidade",
      "data_fabricacao",
      "data_validade",
      "etiqueta",
    ])) {
      casos.push(["POST", "/lotes", c]);
    }
    for (const tipo of NAO_ESCALARES) {
      casos.push(["POST", "/lotes", { ...lote, etiqueta: { tipo, codigo: "X" } }]);
      casos.push(["POST", "/lotes/1/etiqueta", { tipo, codigo: "X" }]);
    }
    for (const codigo of NAO_ESCALARES) {
      casos.push(["POST", "/lotes", { ...lote, etiqueta: { tipo: "rfid", codigo } }]);
      casos.push(["POST", "/lotes/1/etiqueta", { tipo: "rfid", codigo }]);
      casos.push(["POST", "/lotes/1/bloquear", { motivo: codigo }]);
    }
    for (const [metodo, caminho, corpo] of casos) {
      const r = await chamarApi(servidor, metodo, caminho, operador, corpo);
      assert.equal(r.status, 400, `${metodo} ${caminho} ${JSON.stringify(corpo)}`);
    }
  });

  it("corpos com arrays e objetos em usuários e login", async () => {
    const base = { nome: "N", email: "a@b.co", senha: "senha-longa-ok", perfil: "operador" };
    const campos = ["nome", "email", "senha", "perfil"];
    for (const corpo of corposComCampoInvalido(base, campos)) {
      for (const [metodo, caminho] of [
        ["POST", "/usuarios"],
        ["PATCH", "/usuarios/1"],
      ]) {
        const r = await chamarApi(servidor, metodo ?? "POST", caminho ?? "/usuarios", admin, corpo);
        assert.equal(r.status, 400, `${metodo} ${caminho} ${JSON.stringify(corpo)}`);
      }
    }
    for (const corpo of corposComCampoInvalido({ email: "a@b.co", senha: "x" }, ["email", "senha"]).slice(0, 10)) {
      const r = await chamarApi(servidor, "POST", "/auth/login", undefined, corpo);
      assert.equal(r.status, 400, JSON.stringify(corpo));
    }
  });
});
