import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/db.ts";
import { segurarLote } from "./trava.ts";

describe("segurarLote", () => {
  after(async () => {
    await prisma.$disconnect();
  });

  it("propaga a falha da transação que não conseguiu travar, sem ficar pendurado", async () => {
    const limite = new Promise<string>((ok) => setTimeout(() => ok("pendurado"), 5000));
    const resultado = await Promise.race([segurarLote(2 ** 40).then(() => "travou", () => "rejeitou"), limite]);
    assert.equal(resultado, "rejeitou");
  });
});
