import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi, type RespostaApi } from "./api.ts";
import { criarUsuarioTeste, desativarUsuariosTeste, subir, tokenDe, type Servidor } from "./helpers.ts";

function porta(): { promessa: Promise<void>; liberar: () => void } {
  let liberar: () => void = () => {};
  const promessa = new Promise<void>((ok) => (liberar = ok));
  return { promessa, liberar };
}

const pendente = (p: Promise<RespostaApi>, ms = 400): Promise<RespostaApi | "pendente"> =>
  Promise.race([p, new Promise<"pendente">((ok) => setTimeout(() => ok("pendente"), ms))]);

describe("criação de lote concorrente com inativação do produto (K3)", () => {
  const prefixo = `K3${randomUUID().slice(0, 8)}`;
  let servidor: Servidor;
  let operador: string;
  let idLocalizacao: number;

  const novoProduto = async (nome: string): Promise<number> =>
    (await prisma.produto.create({ data: { nome: `${prefixo}-${nome}`, unidade_medida: "UN" } })).id_produto;
  const criarLote = (idProduto: number, numero: string): Promise<RespostaApi> =>
    chamarApi(servidor, "POST", "/lotes", operador, {
      numero_lote: `${prefixo}-${numero}`,
      id_produto: idProduto,
      id_localizacao: idLocalizacao,
    });

  before(async () => {
    servidor = await subir(createApp());
    operador = await tokenDe(await criarUsuarioTeste("operador"));
    idLocalizacao = (await prisma.localizacao.create({ data: { corredor: prefixo, nivel: "1", posicao: "A" } }))
      .id_localizacao;
  });

  after(async () => {
    await servidor.fechar();
    await prisma.produto.updateMany({ where: { nome: { startsWith: prefixo } }, data: { ativo: false } });
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("inativação em andamento: a criação espera e depois é recusada (nunca lote em produto inativo)", async () => {
    const idProduto = await novoProduto("a");
    const travou = porta();
    const soltar = porta();
    const inativacao = prisma.$transaction(
      async (tx) => {
        await tx.produto.update({ where: { id_produto: idProduto }, data: { ativo: false } });
        travou.liberar();
        await soltar.promessa;
      },
      { timeout: 20000 },
    );
    await travou.promessa;
    let criacao: Promise<RespostaApi>;
    try {
      criacao = criarLote(idProduto, "a1");
      assert.equal(await pendente(criacao), "pendente");
    } finally {
      soltar.liberar();
      await inativacao;
    }
    const r = await criacao;
    assert.equal(r.status, 422);
    assert.equal((r.corpo as { erro: { codigo: string } }).erro.codigo, "PRODUTO_INATIVO");
    assert.equal(await prisma.lote.count({ where: { id_produto: idProduto } }), 0);
  });

  it("criação em andamento: a inativação espera a trava e o lote criado antes é aceito", async () => {
    const idProduto = await novoProduto("b");
    const travou = porta();
    const soltar = porta();
    const retencao = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT ativo FROM produto WHERE id_produto = ${idProduto} FOR SHARE`;
        travou.liberar();
        await soltar.promessa;
      },
      { timeout: 20000 },
    );
    await travou.promessa;
    let inativar: Promise<RespostaApi>;
    try {
      inativar = chamarApi(servidor, "POST", `/produtos/${idProduto}/inativar`, operador);
      assert.equal(await pendente(inativar), "pendente");
      const criado = await criarLote(idProduto, "b1");
      assert.equal(criado.status, 201);
      assert.equal(await pendente(inativar, 200), "pendente");
    } finally {
      soltar.liberar();
      await retencao;
    }
    assert.equal((await inativar).status, 200);
    assert.equal((await criarLote(idProduto, "b2")).status, 422);
    assert.equal(await prisma.lote.count({ where: { id_produto: idProduto } }), 1);
  });

  it("disputa em massa: só 201 ou 422, e depois da inativação nenhuma criação passa", async () => {
    const idProduto = await novoProduto("c");
    const pedidos: Promise<RespostaApi>[] = [];
    for (let i = 0; i < 12; i++) {
      pedidos.push(criarLote(idProduto, `c${i}`));
      if (i === 5) pedidos.push(chamarApi(servidor, "POST", `/produtos/${idProduto}/inativar`, operador));
    }
    const respostas = await Promise.all(pedidos);
    for (const r of respostas) assert.ok([200, 201, 422].includes(r.status), String(r.status));
    assert.equal((await criarLote(idProduto, "c-depois")).status, 422);
    const produto = await prisma.produto.findUnique({ where: { id_produto: idProduto } });
    assert.equal(produto?.ativo, false);
  });
});
