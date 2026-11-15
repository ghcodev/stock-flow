import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

describe("duração do token", () => {
  it("é 28800 s mesmo com JWT_EXPIRES_IN definida antes dos imports", () => {
    const r = spawnSync(process.execPath, ["tests/fixtures/duracao-token.ts"], {
      env: {
        PATH: process.env.PATH ?? "",
        SystemRoot: process.env.SystemRoot ?? "",
        DATABASE_URL: "postgresql://u:p@127.0.0.1:1/d",
        JWT_SECRET: "x".repeat(40),
        JWT_EXPIRES_IN: "1m",
      },
      encoding: "utf8",
      timeout: 15000,
    });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), "28800");
  });
});
