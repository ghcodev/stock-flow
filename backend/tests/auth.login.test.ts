import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { jwtVerify } from "jose";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { config } from "../src/config.ts";
import {
  criarUsuarioTeste,
  desativarUsuariosTeste,
  subir,
  type Servidor,
  type UsuarioTeste,
} from "./helpers.ts";

function login(servidor: Servidor, corpo: unknown): Promise<Response> {
  return fetch(`${servidor.url}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

describe("POST /auth/login", () => {
  let servidor: Servidor;
  let ativo: UsuarioTeste;
  let inativo: UsuarioTeste;

  before(async () => {
    servidor = await subir(createApp());
    ativo = await criarUsuarioTeste("operador");
    inativo = await criarUsuarioTeste("operador", false);
  });

  after(async () => {
    await servidor.fechar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("login correto devolve token HS256 de 8 h e dados sem senha_hash", async () => {
    const res = await login(servidor, { email: ativo.email, senha: ativo.senha });
    assert.equal(res.status, 200);
    const texto = await res.text();
    assert.doesNotMatch(texto, /senha_hash|\$2[aby]\$/);
    const corpo = JSON.parse(texto) as {
      token: string;
      usuario: Record<string, unknown>;
    };
    assert.deepEqual(corpo.usuario, {
      id_usuario: ativo.id,
      nome: `Teste ${ativo.senha.slice("Senha-".length)}`,
      email: ativo.email,
      perfil: "operador",
    });
    const { payload, protectedHeader } = await jwtVerify(
      corpo.token,
      new TextEncoder().encode(config.jwtSecret),
      { algorithms: ["HS256"] },
    );
    assert.equal(protectedHeader.alg, "HS256");
    assert.equal(payload.sub, String(ativo.id));
    assert.equal(payload.perfil, "operador");
    assert.equal((payload.exp ?? 0) - (payload.iat ?? 0), 8 * 60 * 60);
    assert.deepEqual(Object.keys(payload).sort(), ["exp", "iat", "perfil", "sub"]);
  });

  it("senha errada, e-mail inexistente e usuário inativo dão o mesmo 401", async () => {
    const tentativas = [
      { email: ativo.email, senha: "senha-errada" },
      { email: `nao-existe-${ativo.id}@teste.local`, senha: ativo.senha },
      { email: inativo.email, senha: inativo.senha },
    ];
    const respostas: { status: number; corpo: unknown }[] = [];
    for (const tentativa of tentativas) {
      const res = await login(servidor, tentativa);
      respostas.push({ status: res.status, corpo: await res.json() });
    }
    for (const resposta of respostas) {
      assert.equal(resposta.status, 401);
      assert.deepEqual(resposta.corpo, respostas[0]?.corpo);
    }
    assert.deepEqual(respostas[0]?.corpo, {
      erro: { codigo: "CREDENCIAIS_INVALIDAS", mensagem: "E-mail ou senha inválidos" },
    });
  });

  it("corpo inválido responde 400 com a lista de campos e sem ecoar a senha", async () => {
    const vazio = await login(servidor, {});
    assert.equal(vazio.status, 400);
    const corpoVazio = (await vazio.json()) as {
      erro: { codigo: string; campos: { campo: string }[] };
    };
    assert.equal(corpoVazio.erro.codigo, "VALIDACAO");
    assert.deepEqual(corpoVazio.erro.campos.map((c) => c.campo).sort(), ["email", "senha"]);

    const senhaGigante = "S3gredo-".repeat(200);
    const longa = await login(servidor, { email: "a@b.co", senha: senhaGigante });
    assert.equal(longa.status, 400);
    const texto = await longa.text();
    assert.doesNotMatch(texto, /S3gredo/);
    assert.deepEqual(
      (JSON.parse(texto) as { erro: { campos: { campo: string }[] } }).erro.campos.map((c) => c.campo),
      ["senha"],
    );

    const tipo = await login(servidor, { email: ["a@b.co"], senha: 123 });
    assert.equal(tipo.status, 400);
  });

  it("é pública: responde sem token", async () => {
    const res = await login(servidor, { email: ativo.email, senha: ativo.senha });
    assert.equal(res.status, 200);
  });
});

describe("limite de tentativas com JSON malformado", () => {
  let servidor: Servidor;

  before(async () => {
    servidor = await subir(createApp());
  });

  after(async () => {
    await servidor.fechar();
    await prisma.$disconnect();
  });

  it("a 11ª resposta é 429 mesmo com corpo malformado", async () => {
    const malformado = (): Promise<Response> =>
      fetch(`${servidor.url}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{invalido",
      });
    for (let i = 0; i < 10; i++) {
      assert.equal((await malformado()).status, 400);
    }
    assert.equal((await malformado()).status, 429);
  });
});

describe("limite de tentativas de login", () => {
  let servidor: Servidor;

  before(async () => {
    servidor = await subir(createApp());
  });

  after(async () => {
    await servidor.fechar();
    await prisma.$disconnect();
  });

  it("a 11ª tentativa em 15 minutos responde 429 em JSON", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await login(servidor, {});
      assert.equal(res.status, 400);
    }
    const res = await login(servidor, {});
    assert.equal(res.status, 429);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await res.json(), {
      erro: {
        codigo: "MUITAS_TENTATIVAS",
        mensagem: "Muitas tentativas de login. Tente novamente em 15 minutos.",
      },
    });
  });
});
