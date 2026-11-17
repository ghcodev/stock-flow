import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function ambienteCom(fuso: string): NodeJS.ProcessEnv {
  const ambiente: NodeJS.ProcessEnv = { ...process.env, TZ: fuso };
  delete ambiente.NODE_TEST_CONTEXT;
  return ambiente;
}

describe("filtros de período não dependem do fuso do processo", () => {
  for (const fuso of ["UTC", "America/Sao_Paulo"]) {
    it(`historico.test.ts passa com TZ=${fuso}`, () => {
      const r = spawnSync(process.execPath, ["--test", "tests/historico.test.ts"], {
        env: ambienteCom(fuso),
        encoding: "utf8",
        timeout: 120000,
      });
      assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`.slice(-1500));
      assert.match(r.stdout, /ℹ pass [1-9]\d*/);
      assert.match(r.stdout, /ℹ fail 0/);
    });
  }
});
