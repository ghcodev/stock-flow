import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lerInstante, periodoValido } from "../src/periodo.ts";

function valido(de: string, ate: string): boolean {
  const inicio = lerInstante(de);
  const fim = lerInstante(ate);
  assert.ok(inicio && fim, `${de} / ${ate}`);
  return periodoValido(inicio, fim);
}

describe("validade do intervalo de período", () => {
  it("instante dentro do dia inteiro do fim é válido (de com hora, ate só com dia)", () => {
    assert.equal(valido("2026-11-15T12:00:00Z", "2026-11-15"), true);
    assert.equal(valido("2026-11-15T23:59:59.999Z", "2026-11-15"), true);
  });

  it("dia inteiro no início e instante no fim", () => {
    assert.equal(valido("2026-11-15", "2026-11-15T12:00:00Z"), true);
    assert.equal(valido("2026-11-15", "2026-11-15T00:00:00Z"), true);
  });

  it("igualdade: mesmo dia, mesmo instante e deslocamentos equivalentes", () => {
    assert.equal(valido("2026-11-15", "2026-11-15"), true);
    assert.equal(valido("2026-11-15T12:00:00Z", "2026-11-15T12:00:00Z"), true);
    assert.equal(valido("2026-11-15T09:00:00-03:00", "2026-11-15T12:00:00Z"), true);
  });

  it("intervalo invertido é inválido", () => {
    assert.equal(valido("2026-11-16", "2026-11-15"), false);
    assert.equal(valido("2026-11-16T00:00:00Z", "2026-11-15"), false);
    assert.equal(valido("2026-11-15T12:00:01Z", "2026-11-15T12:00:00Z"), false);
    assert.equal(valido("2026-11-15T12:00:00-03:00", "2026-11-15T12:00:00Z"), false);
  });
});
