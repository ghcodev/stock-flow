import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { criarUsuarioTeste, desativarUsuariosTeste, subir, tokenDe, type Servidor } from "./helpers.ts";

describe("transações não disparam consultas concorrentes no mesmo cliente do pg", () => {
  const prefixo = `W${randomUUID().slice(0, 8)}`;
  let servidor: Servidor;
  let token: string;
  let admin: string;
  const avisos: string[] = [];
  const registrar = (aviso: Error): void => {
    avisos.push(`${aviso.name}: ${aviso.message}`);
  };

  before(async () => {
    process.on("warning", registrar);
    servidor = await subir(createApp());
    token = await tokenDe(await criarUsuarioTeste("operador"));
    admin = await tokenDe(await criarUsuarioTeste("administrador"));
  });

  after(async () => {
    process.off("warning", registrar);
    await servidor.fechar();
    await prisma.produto.updateMany({ where: { nome: { startsWith: prefixo } }, data: { ativo: false } });
    await prisma.usuario.updateMany({ where: { email: { startsWith: prefixo.toLowerCase() } }, data: { ativo: false } });
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("criar lote com etiqueta e saldo, bloquear, desbloquear, associar etiqueta e criar usuário", async () => {
    const produto = await prisma.produto.create({ data: { nome: `${prefixo}-p`, unidade_medida: "UN" } });
    const local = await prisma.localizacao.create({ data: { corredor: prefixo, nivel: "1", posicao: "A" } });
    const criado = await chamarApi(servidor, "POST", "/lotes", token, {
      numero_lote: `${prefixo}-1`,
      id_produto: produto.id_produto,
      id_localizacao: local.id_localizacao,
      quantidade: 4,
      etiqueta: { tipo: "rfid", codigo: `RF-${prefixo}` },
    });
    assert.equal(criado.status, 201);
    const id = (criado.corpo as { id_lote: number }).id_lote;
    assert.equal((await chamarApi(servidor, "POST", `/lotes/${id}/bloquear`, token, { motivo: "teste" })).status, 200);
    assert.equal((await chamarApi(servidor, "POST", `/lotes/${id}/desbloquear`, token)).status, 200);
    const outro = await chamarApi(servidor, "POST", "/lotes", token, {
      numero_lote: `${prefixo}-2`,
      id_produto: produto.id_produto,
      id_localizacao: local.id_localizacao,
    });
    const idOutro = (outro.corpo as { id_lote: number }).id_lote;
    assert.equal(
      (await chamarApi(servidor, "POST", `/lotes/${idOutro}/etiqueta`, token, { tipo: "qr_code", codigo: `QR-${prefixo}` })).status,
      201,
    );
    const usuario = await chamarApi(servidor, "POST", "/usuarios", admin, {
      nome: "Aviso",
      email: `${prefixo.toLowerCase()}@teste.local`,
      senha: "senha-longa-ok",
      perfil: "operador",
    });
    assert.equal(usuario.status, 201);
    await new Promise((ok) => setTimeout(ok, 200));
    assert.deepEqual(avisos.filter((a) => a.includes("client.query")), []);
  });
});
