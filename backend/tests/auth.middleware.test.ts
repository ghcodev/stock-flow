import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { config } from "../src/config.ts";
import {
  criarUsuarioTeste,
  desativarUsuariosTeste,
  subir,
  tokenDe,
  type Servidor,
  type UsuarioTeste,
} from "./helpers.ts";

const agora = (): number => Math.floor(Date.now() / 1000);

function assinar(id: number, segredo: string, alg: string, exp: number): Promise<string> {
  return new SignJWT({ perfil: "administrador" })
    .setProtectedHeader({ alg })
    .setSubject(String(id))
    .setIssuedAt(agora() - 100)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(segredo));
}

function base64url(objeto: unknown): string {
  return Buffer.from(JSON.stringify(objeto)).toString("base64url");
}

describe("autenticação por padrão", () => {
  let servidor: Servidor;
  let usuario: UsuarioTeste;

  const chamar = (caminho: string, token?: string, init: RequestInit = {}): Promise<Response> =>
    fetch(`${servidor.url}${caminho}`, {
      ...init,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });

  const esperar401 = async (res: Response): Promise<void> => {
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), {
      erro: { codigo: "NAO_AUTENTICADO", mensagem: "Autenticação inválida ou ausente" },
    });
  };

  before(async () => {
    servidor = await subir(
      createApp((a) => {
        a.get("/_teste/protegida", (_req, res) => {
          res.json({ ok: true });
        });
      }),
    );
    usuario = await criarUsuarioTeste("operador");
  });

  after(async () => {
    await servidor.fechar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("token válido acessa /auth/me e recebe o usuário sem senha_hash", async () => {
    const res = await chamar("/auth/me", await tokenDe(usuario));
    assert.equal(res.status, 200);
    const texto = await res.text();
    assert.doesNotMatch(texto, /senha_hash|\$2[aby]\$/);
    assert.deepEqual(JSON.parse(texto), {
      usuario: {
        id_usuario: usuario.id,
        nome: `Teste ${usuario.senha.slice("Senha-".length)}`,
        email: usuario.email,
        perfil: "operador",
      },
    });
  });

  it("sem token, com esquema errado ou token malformado: 401", async () => {
    await esperar401(await chamar("/auth/me"));
    await esperar401(await chamar("/_teste/protegida"));
    await esperar401(await chamar("/auth/me", "isto-nao-e-um-jwt"));
    await esperar401(
      await fetch(`${servidor.url}/auth/me`, {
        headers: { authorization: `Basic ${await tokenDe(usuario)}` },
      }),
    );
  });

  it("token adulterado: 401", async () => {
    const [cabecalho, corpo, assinatura] = (await tokenDe(usuario)).split(".");
    const outroCorpo = base64url({ perfil: "administrador", sub: String(usuario.id), exp: agora() + 3600 });
    await esperar401(await chamar("/auth/me", `${cabecalho}.${outroCorpo}.${assinatura}`));
    const trocada = `${assinatura?.[0] === "A" ? "B" : "A"}${assinatura?.slice(1)}`;
    await esperar401(await chamar("/auth/me", `${cabecalho}.${corpo}.${trocada}`));
  });

  it("alg none: 401", async () => {
    const semAssinatura = `${base64url({ alg: "none", typ: "JWT" })}.${base64url({
      sub: String(usuario.id),
      perfil: "operador",
      exp: agora() + 3600,
    })}.`;
    await esperar401(await chamar("/auth/me", semAssinatura));
  });

  it("outro algoritmo HMAC com o segredo correto: 401", async () => {
    await esperar401(
      await chamar("/auth/me", await assinar(usuario.id, config.jwtSecret, "HS512", agora() + 3600)),
    );
  });

  it("token expirado: 401", async () => {
    await esperar401(
      await chamar("/auth/me", await assinar(usuario.id, config.jwtSecret, "HS256", agora() - 10)),
    );
  });

  it("token com segredo certo mas sem exp, sem iat ou mais velho que 8 h: 401", async () => {
    const chave = new TextEncoder().encode(config.jwtSecret);
    const base = (): SignJWT =>
      new SignJWT({ perfil: "operador" }).setProtectedHeader({ alg: "HS256" }).setSubject(String(usuario.id));
    const semExp = await base().setIssuedAt().sign(chave);
    const semIat = await base().setExpirationTime(agora() + 3600).sign(chave);
    const velho = await base()
      .setIssuedAt(agora() - 9 * 3600)
      .setExpirationTime(agora() + 3600)
      .sign(chave);
    const valido = await base()
      .setIssuedAt()
      .setExpirationTime(agora() + 3600)
      .sign(chave);
    await esperar401(await chamar("/auth/me", semExp));
    await esperar401(await chamar("/auth/me", semIat));
    await esperar401(await chamar("/auth/me", velho));
    assert.equal((await chamar("/auth/me", valido)).status, 200);
  });

  it("assinado com segredo errado: 401", async () => {
    await esperar401(
      await chamar("/auth/me", await assinar(usuario.id, "outro-segredo-".repeat(4), "HS256", agora() + 3600)),
    );
  });

  it("sub inexistente ou inválido: 401", async () => {
    await esperar401(
      await chamar("/auth/me", await assinar(2_000_000_000, config.jwtSecret, "HS256", agora() + 3600)),
    );
    const invalido = await new SignJWT({ perfil: "operador" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("1; DROP TABLE usuario")
      .setExpirationTime(agora() + 3600)
      .sign(new TextEncoder().encode(config.jwtSecret));
    await esperar401(await chamar("/auth/me", invalido));
  });

  it("usuário inativado depois do login: 401 na requisição seguinte", async () => {
    const alvo = await criarUsuarioTeste("operador");
    const token = await tokenDe(alvo);
    assert.equal((await chamar("/auth/me", token)).status, 200);
    await prisma.usuario.update({ where: { id_usuario: alvo.id }, data: { ativo: false } });
    await esperar401(await chamar("/auth/me", token));
  });

  it("perfil alterado no banco depois do login vale na requisição seguinte", async () => {
    const alvo = await criarUsuarioTeste("operador");
    const token = await tokenDe(alvo);
    const antes = (await (await chamar("/auth/me", token)).json()) as { usuario: { perfil: string } };
    assert.equal(antes.usuario.perfil, "operador");
    await prisma.usuario.update({ where: { id_usuario: alvo.id }, data: { perfil: "administrador" } });
    const depois = (await (await chamar("/auth/me", token)).json()) as { usuario: { perfil: string } };
    assert.equal(depois.usuario.perfil, "administrador");
  });

  it("rota registrada sem declarar autenticação nasce protegida", async () => {
    await esperar401(await chamar("/_teste/protegida"));
    assert.equal((await chamar("/_teste/protegida", await tokenDe(usuario))).status, 200);
  });

  it("/health e /auth/login seguem públicos", async () => {
    assert.equal((await chamar("/health")).status, 200);
    const login = await fetch(`${servidor.url}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(login.status, 400);
  });

  it("rota inexistente sem token responde 401 e com token 404", async () => {
    await esperar401(await chamar("/nao-existe"));
    assert.equal((await chamar("/nao-existe", await tokenDe(usuario))).status, 404);
  });
});
