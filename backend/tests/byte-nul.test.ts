import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { criarUsuarioTeste, desativarUsuariosTeste, subir, tokenDe, type Servidor } from "./helpers.ts";

const NUL = "\u0000";

describe("byte NUL em campos de texto e de busca vira 400", () => {
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

  const esperar400 = async (metodo: string, caminho: string, token: string, corpo?: unknown): Promise<void> => {
    const r = await chamarApi(servidor, metodo, caminho, token, corpo);
    assert.equal(r.status, 400, `${metodo} ${caminho} ${JSON.stringify(corpo)}`);
  };

  it("produtos: criar e editar", async () => {
    const base = { nome: "N", unidade_medida: "UN" };
    for (const campo of ["nome", "unidade_medida", "categoria", "descricao"]) {
      await esperar400("POST", "/produtos", operador, { ...base, [campo]: `ab${NUL}cd` });
      await esperar400("PATCH", "/produtos/1", operador, { [campo]: `ab${NUL}cd` });
    }
  });

  it("localizações: criar", async () => {
    const base = { corredor: "C", nivel: "1", posicao: "A" };
    for (const campo of ["corredor", "nivel", "posicao", "descricao"]) {
      await esperar400("POST", "/localizacoes", operador, { ...base, [campo]: `a${NUL}` });
    }
  });

  it("lotes: criar, bloquear e etiqueta", async () => {
    const base = { numero_lote: "L", id_produto: 1, id_localizacao: 1 };
    await esperar400("POST", "/lotes", operador, { ...base, numero_lote: `L${NUL}1` });
    await esperar400("POST", "/lotes", operador, { ...base, etiqueta: { tipo: "rfid", codigo: `X${NUL}` } });
    await esperar400("POST", "/lotes/1/bloquear", operador, { motivo: `m${NUL}` });
    await esperar400("POST", "/lotes/1/etiqueta", operador, { tipo: "qr_code", codigo: `X${NUL}Y` });
  });

  it("usuários: nome, e-mail e senha, criar e editar", async () => {
    const base = { nome: "N", email: "a@b.co", senha: "senha-longa-ok", perfil: "operador" };
    for (const campo of ["nome", "email", "senha"]) {
      const valor = campo === "email" ? `a${NUL}@b.co` : `abcd${NUL}efghij`;
      await esperar400("POST", "/usuarios", admin, { ...base, [campo]: valor });
      await esperar400("PATCH", "/usuarios/1", admin, { [campo]: valor });
    }
  });

  it("login: senha e e-mail com NUL (o bcrypt truncaria a senha no NUL)", async () => {
    await esperar400("POST", "/auth/login", "", { email: "a@b.co", senha: `abcd${NUL}efgh` });
    await esperar400("POST", "/auth/login", "", { email: `a${NUL}@b.co`, senha: "x" });
  });

  it("buscas com %00 em todas as listagens", async () => {
    for (const consulta of [
      "/produtos?busca=%00",
      "/produtos?busca=a%00b",
      "/localizacoes?busca=%00",
      "/lotes?numero_lote=%00",
      "/usuarios?busca=%00",
    ]) {
      await esperar400("GET", consulta, admin);
    }
  });
});
