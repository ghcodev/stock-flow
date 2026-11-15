import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import {
  criarUsuarioTeste,
  desativarUsuariosTeste,
  subir,
  tokenDe,
  type Servidor,
  type UsuarioTeste,
} from "./helpers.ts";

type Lote = { id_lote: number; quantidade: string };

describe("saldo inicial do lote vira entrada na mesma transação (K4)", () => {
  const prefixo = `K4${randomUUID().slice(0, 8)}`;
  let servidor: Servidor;
  let usuario: UsuarioTeste;
  let token: string;
  let idProduto: number;
  let idLocalizacao: number;

  const criar = (sufixo: string, extra: Record<string, unknown> = {}) =>
    chamarApi(servidor, "POST", "/lotes", token, {
      numero_lote: `${prefixo}-${sufixo}`,
      id_produto: idProduto,
      id_localizacao: idLocalizacao,
      ...extra,
    });
  const movimentos = (idLote: number) =>
    prisma.movimentacao.findMany({ where: { id_lote: idLote }, orderBy: { id_movimentacao: "asc" } });

  before(async () => {
    servidor = await subir(createApp());
    usuario = await criarUsuarioTeste("operador");
    token = await tokenDe(usuario);
    idProduto = (await prisma.produto.create({ data: { nome: `${prefixo}-prod`, unidade_medida: "UN" } })).id_produto;
    idLocalizacao = (await prisma.localizacao.create({ data: { corredor: prefixo, nivel: "1", posicao: "A" } }))
      .id_localizacao;
  });

  after(async () => {
    await servidor.fechar();
    await prisma.produto.updateMany({ where: { nome: { startsWith: prefixo } }, data: { ativo: false } });
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("quantidade > 0 grava uma entrada com saldo 0 -> quantidade, destino e usuário do contexto", async () => {
    const r = await criar("a", { quantidade: "12.345" });
    assert.equal(r.status, 201);
    const lote = r.corpo as Lote;
    assert.equal(lote.quantidade, "12.345");
    const lista = await movimentos(lote.id_lote);
    assert.equal(lista.length, 1);
    const m = lista[0];
    assert.equal(m?.tipo_movimentacao, "entrada");
    assert.equal(m?.quantidade.toString(), "12.345");
    assert.equal(m?.saldo_anterior.toString(), "0");
    assert.equal(m?.saldo_posterior.toString(), "12.345");
    assert.equal(m?.id_localizacao_destino, idLocalizacao);
    assert.equal(m?.id_localizacao_origem, null);
    assert.equal(m?.id_usuario, usuario.id);
    assert.equal(m?.status_movimentacao, "concluida");
  });

  it("o saldo do lote é igual ao saldo_posterior da última movimentação e não é somado duas vezes", async () => {
    const lote = (await criar("b", { quantidade: 40 })).corpo as Lote;
    const ultima = (await movimentos(lote.id_lote)).at(-1);
    const noBanco = await prisma.lote.findUnique({ where: { id_lote: lote.id_lote } });
    assert.equal(noBanco?.quantidade.toString(), "40");
    assert.equal(ultima?.saldo_posterior.toString(), noBanco?.quantidade.toString());
    const soma = await prisma.movimentacao.aggregate({
      where: { id_lote: lote.id_lote, tipo_movimentacao: "entrada" },
      _sum: { quantidade: true },
    });
    assert.equal(soma._sum.quantidade?.toString(), "40");
  });

  it("a movimentação é auditada com o id_usuario correto", async () => {
    const lote = (await criar("c", { quantidade: 5 })).corpo as Lote;
    const [m] = await movimentos(lote.id_lote);
    const linhas = await prisma.$queryRaw<{ id_usuario: number | null; operacao: string }[]>`
      SELECT id_usuario, operacao::text AS operacao FROM auditoria_log
      WHERE tabela_afetada = 'movimentacao' AND (valor_novo->>'id_movimentacao')::bigint = ${m?.id_movimentacao ?? 0}`;
    assert.equal(linhas.length, 1);
    assert.equal(linhas[0]?.operacao, "INSERT");
    assert.equal(linhas[0]?.id_usuario, usuario.id);
  });

  it("quantidade 0, \"0.000\" ou omitida não grava entrada", async () => {
    for (const [sufixo, extra] of [
      ["d1", { quantidade: 0 }],
      ["d2", { quantidade: "0.000" }],
      ["d3", {}],
    ] as [string, Record<string, unknown>][]) {
      const r = await criar(sufixo, extra);
      assert.equal(r.status, 201, sufixo);
      assert.equal((await movimentos((r.corpo as Lote).id_lote)).length, 0, sufixo);
    }
  });

  it("falha na criação (etiqueta duplicada) não deixa lote nem movimentação", async () => {
    const codigo = `QR-${prefixo}-dup`;
    assert.equal((await criar("e1", { quantidade: 3, etiqueta: { tipo: "qr_code", codigo } })).status, 201);
    const r = await criar("e2", { quantidade: 9, etiqueta: { tipo: "qr_code", codigo } });
    assert.equal(r.status, 409);
    assert.equal(await prisma.lote.count({ where: { numero_lote: `${prefixo}-e2` } }), 0);
    const total = await prisma.movimentacao.aggregate({
      where: { lote: { numero_lote: { startsWith: `${prefixo}-e` } } },
      _sum: { quantidade: true },
    });
    assert.equal(total._sum.quantidade?.toString(), "3");
  });
});
