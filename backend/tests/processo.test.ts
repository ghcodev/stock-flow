import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

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
