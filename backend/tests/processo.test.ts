import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import net from "node:net";
import type { AddressInfo } from "node:net";

const ENV_VALIDO = {
  DATABASE_URL: "postgresql://u:SENHA-SINTETICA@127.0.0.1:1/d",
  JWT_SECRET: "x".repeat(40),
  PORT: "0",
};

function rodarEntradaComFalha(arquivo: string, conteudo: string) {
  const base = join(process.cwd(), "tests", "tmp");
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, "boot-"));
  try {
    cpSync("src", join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", arquivo), conteudo);
    return rodar([join(dir, "src", "server.ts")], ENV_VALIDO);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function rodar(args: string[], env: Record<string, string>) {
  return spawnSync(process.execPath, args, {
    env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", ...env },
    encoding: "utf8",
    timeout: 15000,
  });
}

describe("falhas fatais do processo", () => {
  it("variável ausente no boot sai com 1, mensagem curta e sem stack", () => {
    const r = rodar(["src/server.ts"], { DATABASE_URL: "", JWT_SECRET: "" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /^Configuração inválida: Variável de ambiente obrigatória ausente: /);
    assert.doesNotMatch(r.stderr, /\n\s+at |node:internal|\.ts:\d/);
  });

  it("JWT_SECRET curto sai com 1 sem revelar o valor", () => {
    const r = rodar(["src/server.ts"], {
      DATABASE_URL: "postgresql://u:SENHA-SINTETICA@127.0.0.1:1/d",
      JWT_SECRET: "VALOR-CURTO",
    });
    assert.equal(r.status, 1);
    assert.doesNotMatch(r.stderr, /VALOR-CURTO|SENHA-SINTETICA|\n\s+at /);
  });

  for (const [nome, arquivo, conteudo] of [
    ["falha no import de app", "app.ts", 'throw new Error("SEGREDO-NO-IMPORT");\nexport const app = null;\n'],
    ["falha no import de db", "db.ts", 'throw new Error("SEGREDO-NO-IMPORT");\nexport const prisma = null;\n'],
    ["erro de sintaxe em app", "app.ts", "export const app = {;\n"],
    [
      "falha na inicialização (listen)",
      "app.ts",
      'export const app = { listen() { throw new Error("SEGREDO-NO-IMPORT"); } };\n',
    ],
  ]) {
    it(`entrypoint: ${nome} sai com 1 e mensagem fixa`, () => {
      const r = rodarEntradaComFalha(arquivo, conteudo);
      assert.equal(r.status, 1);
      assert.equal(r.stderr, "Erro fatal: falha na inicialização\n");
      assert.equal(r.stdout, "");
    });
  }

  it("entrypoint: porta ocupada não anuncia a porta e sai com 1", async () => {
    const ocupante = net.createServer();
    await new Promise<void>((ok) => ocupante.listen(0, ok));
    const { port } = ocupante.address() as AddressInfo;
    try {
      const r = rodar(["src/server.ts"], { ...ENV_VALIDO, PORT: String(port) });
      assert.equal(r.status, 1);
      assert.equal(r.stdout, "");
      assert.equal(r.stderr, "Erro fatal: falha no servidor HTTP\n");
    } finally {
      ocupante.close();
    }
  });

  it("desconectar pendente sem handles ativos sai com 1 pelo prazo, não com 0", () => {
    const r = rodar(["tests/fixtures/falhas.ts", "desconectar-pendente"], {});
    assert.equal(r.status, 1);
    assert.equal(r.stderr, "");
  });

  for (const modo of ["sigterm", "sigint"]) {
    it(`${modo}: liga o sinal ao encerramento e sai com 0`, () => {
      const r = rodar(["tests/fixtures/falhas.ts", modo], {});
      assert.equal(r.status, 0);
      assert.equal(r.stderr, "");
    });
  }

  for (const [modo, mensagem] of [
    ["excecao", "exceção não tratada"],
    ["rejeicao", "promessa rejeitada sem tratamento"],
    ["porta-ocupada", "falha no servidor HTTP"],
  ]) {
    it(`${modo}: mensagem fixa, sem erro bruto e saída 1`, () => {
      const r = rodar(["tests/fixtures/falhas.ts", modo], {});
      assert.equal(r.status, 1);
      assert.equal(r.stderr, `Erro fatal: ${mensagem}\n`);
    });
  }
});
