import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { subir, type Servidor } from "./helpers.ts";

describe("esqueleto da API", () => {
  let servidor: Servidor;

  before(async () => {
    const app = createApp((a) => {
      a.get("/_teste/erro", () => {
        throw new Error("segredo interno postgres://usuario:senha@host");
      });
      a.get("/_teste/erro/:id", (req) => {
        const err = new Error("falha");
        err.name = `Nome-${req.params.id}`;
        throw err;
      });
      a.get("/_teste/numeros", async (_req, res) => {
        const linhas = await prisma.$queryRaw<
          { grande: bigint; decimal: unknown }[]
        >`SELECT 9007199254740993::bigint AS grande, 1.500::numeric(12,3) AS decimal`;
        res.json(linhas[0]);
      });
    });
    servidor = await subir(app);
  });

  after(async () => {
    await servidor.fechar();
    await prisma.$disconnect();
  });

  it("GET /health responde 200", async () => {
    const res = await fetch(`${servidor.url}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
    assert.equal(res.headers.get("x-powered-by"), null);
  });

  it("rota inexistente responde 404 em JSON", async () => {
    const res = await fetch(`${servidor.url}/nao-existe`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    const corpo = (await res.json()) as { erro: { codigo: string } };
    assert.equal(corpo.erro.codigo, "ROTA_NAO_ENCONTRADA");
  });

  it("erro interno não vaza stack trace nem mensagem", async () => {
    const res = await fetch(`${servidor.url}/_teste/erro`);
    assert.equal(res.status, 500);
    const texto = await res.text();
    assert.deepEqual(JSON.parse(texto), {
      erro: { codigo: "ERRO_INTERNO", mensagem: "Erro interno do servidor" },
    });
    assert.doesNotMatch(texto, /segredo|postgres|senha|stack|\.ts/);
  });

  it("log do erro 500 não contém caminho, token nem nome arbitrário", async () => {
    const original = process.stderr.write;
    let capturado = "";
    process.stderr.write = ((trecho: string | Uint8Array) => {
      capturado += String(trecho);
      return true;
    }) as typeof process.stderr.write;
    try {
      const res = await fetch(
        `${servidor.url}/_teste/erro/ID-SINTETICO-12345?token=TOKEN-SINTETICO-abcdef`,
      );
      assert.equal(res.status, 500);
    } finally {
      process.stderr.write = original;
    }
    assert.match(capturado, /erro interno GET Desconhecido/);
    assert.doesNotMatch(capturado, /SINTETICO|_teste|token/i);
  });

  it("BIGINT e NUMERIC saem como texto", async () => {
    const res = await fetch(`${servidor.url}/_teste/numeros`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { grande: "9007199254740993", decimal: "1.5" });
  });

  it("JSON inválido responde 400", async () => {
    const res = await fetch(`${servidor.url}/health`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalido",
    });
    assert.equal(res.status, 400);
    const corpo = (await res.json()) as { erro: { codigo: string } };
    assert.equal(corpo.erro.codigo, "JSON_INVALIDO");
  });
});
