import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { criarUsuarioTeste, desativarUsuariosTeste, subir, tokenDe, type Servidor } from "./helpers.ts";

const CASOS: [string, string, boolean][] = [
  ["7 caracteres", "abcdefg", false],
  ["8 caracteres", "abcdefgh", true],
  ["8 caracteres multibyte (16 bytes)", "çççççççç", true],
  ["72 bytes", "a".repeat(72), true],
  ["73 bytes", "a".repeat(73), false],
  ["37 caracteres multibyte (74 bytes)", "ç".repeat(37), false],
  ["NUL no meio", "abcd\u0000efghij", false],
];

describe("regra única de senha: mínimo de 8 caracteres e máximo de 72 bytes, sem NUL (G5)", () => {
  let servidor: Servidor;
  let admin: string;
  const sufixo = randomUUID().slice(0, 8);
  const criados: string[] = [];

  before(async () => {
    servidor = await subir(createApp());
    admin = await tokenDe(await criarUsuarioTeste("administrador"));
  });

  after(async () => {
    await servidor.fechar();
    await prisma.usuario.updateMany({ where: { email: { in: criados } }, data: { ativo: false } });
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("cadastro, edição e troca aceitam e recusam exatamente os mesmos valores", async () => {
    const alvo = await criarUsuarioTeste("operador");
    const tokenAlvo = await tokenDe(alvo);
    let senhaAtual = alvo.senha;
    let numero = 0;
    for (const [rotulo, senha, valida] of CASOS) {
      numero += 1;
      const email = `regra${numero}-${sufixo}@teste.local`;
      const cadastro = await chamarApi(servidor, "POST", "/usuarios", admin, { nome: "Regra", email, senha, perfil: "operador" });
      if (cadastro.status === 201) criados.push(email);
      assert.equal(cadastro.status === 201, valida, `cadastro: ${rotulo} -> ${cadastro.status}`);
      assert.ok(valida || cadastro.status === 400, `cadastro ${rotulo}`);

      const edicao = await chamarApi(servidor, "PATCH", `/usuarios/${alvo.id}`, admin, { senha });
      assert.equal(edicao.status === 200, valida, `edição: ${rotulo} -> ${edicao.status}`);
      assert.ok(valida || edicao.status === 400, `edição ${rotulo}`);

      const troca = await chamarApi(servidor, "POST", "/auth/senha", tokenAlvo, { senha_atual: valida && edicao.status === 200 ? senha : senhaAtual, nova_senha: senha });
      if (valida) senhaAtual = senha;
      assert.equal(troca.status === 204, valida, `troca: ${rotulo} -> ${troca.status}`);
      assert.ok(valida || troca.status === 400, `troca ${rotulo}`);
      assert.doesNotMatch(cadastro.texto + edicao.texto + troca.texto, /abcdefg|SSSS/);
    }
  });
});
