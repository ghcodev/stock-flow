import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { criarUsuarioTeste, desativarUsuariosTeste, subir, tokenDe, type Servidor } from "./helpers.ts";

describe("trava dos administradores sob concorrência (K7)", () => {
  let servidor: Servidor;

  before(async () => {
    servidor = await subir(createApp());
  });

  after(async () => {
    await servidor.fechar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("dois administradores de teste se inativando ao mesmo tempo: sem deadlock nem 500 e pelo menos um administrador ativo", async () => {
    for (let rodada = 0; rodada < 6; rodada++) {
      const a = await criarUsuarioTeste("administrador");
      const b = await criarUsuarioTeste("administrador");
      const [tokenA, tokenB] = await Promise.all([tokenDe(a), tokenDe(b)]);
      const [r1, r2] = await Promise.all([
        chamarApi(servidor, "POST", `/usuarios/${b.id}/inativar`, tokenA),
        chamarApi(servidor, "POST", `/usuarios/${a.id}/inativar`, tokenB),
      ]);
      const statuses = [r1.status, r2.status].sort();
      assert.ok(statuses.every((s) => s === 200 || s === 401), `rodada ${rodada}: ${statuses.join(",")}`);
      assert.ok(statuses.includes(200), `rodada ${rodada}: nenhuma inativação concluída`);
      const ativosDeTeste = await prisma.usuario.count({ where: { id_usuario: { in: [a.id, b.id] }, ativo: true } });
      assert.ok(ativosDeTeste <= 1, `rodada ${rodada}: os dois seguem ativos`);
    }
    const depois = await prisma.usuario.count({ where: { perfil: "administrador", ativo: true } });
    assert.ok(depois >= 1);
  });

  it("rebaixamentos simultâneos do próprio perfil por dois administradores nunca deixam o sistema sem administrador", async () => {
    for (let rodada = 0; rodada < 4; rodada++) {
      const a = await criarUsuarioTeste("administrador");
      const b = await criarUsuarioTeste("administrador");
      const [tokenA, tokenB] = await Promise.all([tokenDe(a), tokenDe(b)]);
      const respostas = await Promise.all([
        chamarApi(servidor, "PATCH", `/usuarios/${a.id}`, tokenA, { perfil: "operador" }),
        chamarApi(servidor, "PATCH", `/usuarios/${b.id}`, tokenB, { perfil: "operador" }),
      ]);
      for (const r of respostas) assert.ok([200, 401, 403].includes(r.status), `rodada ${rodada}: ${r.status}`);
      const admins = await prisma.usuario.count({ where: { perfil: "administrador", ativo: true } });
      assert.ok(admins >= 1, `rodada ${rodada}`);
    }
  });
});
