import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const FUSOS_DA_SESSAO = ["UTC", "Pacific/Pago_Pago", "Pacific/Kiritimati"];

function ambienteComFusoDoBanco(fusoDoBanco: string, fusoDoProcesso: string): NodeJS.ProcessEnv {
  const ambiente: NodeJS.ProcessEnv = { ...process.env, TZ: fusoDoProcesso };
  delete ambiente.NODE_TEST_CONTEXT;
  const url = ambiente.DATABASE_URL ?? "";
  const separador = url.includes("?") ? "&" : "?";
  ambiente.DATABASE_URL = `${url}${separador}options=${encodeURIComponent(`-c TimeZone=${fusoDoBanco}`)}`;
  return ambiente;
}

describe("a decisão por data de validade não depende do relógio nem do fuso do Node (G2)", () => {
  for (const fusoDoBanco of FUSOS_DA_SESSAO) {
    it(`desbloqueio com a sessão do banco em ${fusoDoBanco} e o Node em America/Sao_Paulo`, () => {
      const r = spawnSync(process.execPath, ["--test", "tests/desbloqueio.test.ts"], {
        env: ambienteComFusoDoBanco(fusoDoBanco, "America/Sao_Paulo"),
        encoding: "utf8",
        timeout: 120000,
      });
      assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`.slice(-1500));
      assert.match(r.stdout, /ℹ pass [1-9]\d*/);
      assert.match(r.stdout, /ℹ fail 0/);
    });
  }

  it("em qualquer hora do dia pelo menos um dos fusos testados tem data diferente da data UTC do Node (o teste exercita o dia divergente)", () => {
    const hojeNoNode = new Date().toISOString().slice(0, 10);
    const r = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        'import { prisma } from "./src/db.ts"; const [l] = await prisma.$queryRaw`SELECT (now() AT TIME ZONE \'Pacific/Pago_Pago\')::date::text AS a, (now() AT TIME ZONE \'Pacific/Kiritimati\')::date::text AS b, (now() AT TIME ZONE \'UTC\')::date::text AS u`; process.stdout.write(JSON.stringify(l)); await prisma.$disconnect();',
      ],
      { env: ambienteComFusoDoBanco("UTC", "UTC"), encoding: "utf8", timeout: 30000 },
    );
    assert.equal(r.status, 0, r.stderr);
    const datas = JSON.parse(r.stdout) as { a: string; b: string; u: string };
    assert.ok(datas.a !== datas.u || datas.b !== datas.u, JSON.stringify(datas));
    assert.ok(datas.u === hojeNoNode || Math.abs(Date.parse(datas.u) - Date.parse(hojeNoNode)) <= 86_400_000);
  });

  it("a sessão do banco realmente muda de fuso com o parâmetro options (a premissa do teste)", () => {
    const ambiente = ambienteComFusoDoBanco("Pacific/Pago_Pago", "UTC");
    const r = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        'import { prisma } from "./src/db.ts"; const [l] = await prisma.$queryRaw`SELECT current_setting(\'TimeZone\') AS fuso`; process.stdout.write(l.fuso); await prisma.$disconnect();',
      ],
      { env: ambiente, encoding: "utf8", timeout: 30000 },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, "Pacific/Pago_Pago");
  });
});
