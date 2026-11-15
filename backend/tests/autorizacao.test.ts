import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { body } from "express-validator";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { config } from "../src/config.ts";
import { exigirPerfil } from "../src/middlewares/perfil.middleware.ts";
import { validar } from "../src/middlewares/validation.middleware.ts";
import {
  criarUsuarioTeste,
  desativarUsuariosTeste,
  subir,
  tokenDe,
  type Servidor,
  type UsuarioTeste,
} from "./helpers.ts";

describe("autorização por perfil e validação", () => {
  let servidor: Servidor;
  let admin: UsuarioTeste;
  let operador: UsuarioTeste;

  const chamar = (caminho: string, token?: string, init: RequestInit = {}): Promise<Response> =>
    fetch(`${servidor.url}${caminho}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });

  before(async () => {
    servidor = await subir(
      createApp((a) => {
        a.get("/_teste/admin", exigirPerfil("administrador"), (_req, res) => {
          res.json({ ok: true });
        });
        a.get("/_teste/ambos", exigirPerfil("administrador", "operador"), (_req, res) => {
          res.json({ ok: true });
        });
        a.post(
          "/_teste/validacao",
          body("quantidade").isInt({ min: 1 }).withMessage("Quantidade deve ser inteira e positiva"),
          body("senha").isLength({ min: 8 }).withMessage("Senha muito curta"),
          validar,
          (_req, res) => {
            res.json({ ok: true });
          },
        );
      }),
    );
    admin = await criarUsuarioTeste("administrador");
    operador = await criarUsuarioTeste("operador");
  });

  after(async () => {
    await servidor.fechar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("perfil sem permissão recebe 403 em JSON", async () => {
    const res = await chamar("/_teste/admin", await tokenDe(operador));
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), {
      erro: { codigo: "ACESSO_NEGADO", mensagem: "Perfil sem permissão para esta operação" },
    });
  });

  it("perfil permitido passa", async () => {
    assert.equal((await chamar("/_teste/admin", await tokenDe(admin))).status, 200);
    assert.equal((await chamar("/_teste/ambos", await tokenDe(operador))).status, 200);
  });

  it("sem token a rota com perfil responde 401, não 403", async () => {
    assert.equal((await chamar("/_teste/admin")).status, 401);
  });

  it("o perfil vem do banco: claim de administrador no token não eleva o operador", async () => {
    const forjado = await new SignJWT({ perfil: "administrador" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(operador.id))
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(config.jwtSecret));
    assert.equal((await chamar("/_teste/admin", forjado)).status, 403);
  });

  it("validação devolve 400 com lista de campos e sem ecoar valores", async () => {
    const res = await chamar("/_teste/validacao", await tokenDe(operador), {
      method: "POST",
      body: JSON.stringify({ quantidade: "abc", senha: "S3N" }),
    });
    assert.equal(res.status, 400);
    const texto = await res.text();
    assert.doesNotMatch(texto, /abc|S3N/);
    assert.deepEqual(JSON.parse(texto), {
      erro: {
        codigo: "VALIDACAO",
        mensagem: "Dados inválidos",
        campos: [
          { campo: "quantidade", mensagem: "Quantidade deve ser inteira e positiva" },
          { campo: "senha", mensagem: "Senha muito curta" },
        ],
      },
    });
  });

  it("validação aceita dados corretos", async () => {
    const res = await chamar("/_teste/validacao", await tokenDe(operador), {
      method: "POST",
      body: JSON.stringify({ quantidade: 3, senha: "uma-senha-longa" }),
    });
    assert.equal(res.status, 200);
  });
});
