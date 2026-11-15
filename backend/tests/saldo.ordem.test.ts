import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi, type RespostaApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";
import { segurarLote } from "./trava.ts";

const esperar = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

async function relogioDoBanco(): Promise<Date> {
  const [linha] = await prisma.$queryRaw<{ agora: Date }[]>`SELECT clock_timestamp() AS agora`;
  return new Date(linha?.agora ?? 0);
}

describe("a data da movimentação é a da trava, não a do início da transação (M2, RN18)", () => {
  let servidor: Servidor;
  let c: Cenario;

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "OR");
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("transações iniciadas antes da liberação da trava gravam data posterior à liberação, na mesma ordem do id e dos saldos", async () => {
    const lote = await c.novoLote("a", { quantidade: "10" });
    const retencao = await segurarLote(lote);
    let liberacao = new Date(0);
    let respostas: RespostaApi[] = [];
    try {
      const primeira = chamarApi(servidor, "POST", "/movimentacoes/entrada", c.operador, { id_lote: lote, quantidade: 1 });
      await esperar(150);
      const segunda = chamarApi(servidor, "POST", "/movimentacoes/entrada", c.admin, { id_lote: lote, quantidade: 2 });
      await esperar(350);
      liberacao = await relogioDoBanco();
      await retencao.liberar();
      respostas = await Promise.all([primeira, segunda]);
    } finally {
      await retencao.liberar();
    }
    assert.deepEqual(respostas.map((r) => r.status), [201, 201]);
    const lista = (await c.movimentos(lote)).slice(1);
    assert.equal(lista.length, 2);
    for (const m of lista) {
      assert.ok(m.data_movimentacao.getTime() >= liberacao.getTime() - 1, `${m.data_movimentacao.toISOString()} < ${liberacao.toISOString()}`);
    }
    assert.ok((lista[0]?.data_movimentacao.getTime() ?? 0) <= (lista[1]?.data_movimentacao.getTime() ?? 0));
    await c.verificarInvariante(lote);
  });

  it("motivo da correção: o DEFAULT now() do banco é o início da transação, não o momento da escrita", async () => {
    const atrasoMedido = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`CREATE TEMP TABLE ordem_default (d timestamptz DEFAULT now()) ON COMMIT DROP`;
      await tx.$queryRaw`SELECT pg_sleep(0.4)::text AS s`;
      await tx.$executeRaw`INSERT INTO ordem_default DEFAULT VALUES`;
      const [linha] = await tx.$queryRaw<{ atraso: boolean }[]>`SELECT (clock_timestamp() - d) > interval '300 ms' AS atraso FROM ordem_default`;
      return linha?.atraso;
    });
    assert.equal(atrasoMedido, true);
  });

  it("a entrada inicial da criação do lote também usa o instante do banco depois da espera pela trava do produto", async () => {
    let soltar: () => void = () => {};
    const espera = new Promise<void>((ok) => (soltar = ok));
    let travou: () => void = () => {};
    const pronto = new Promise<void>((ok) => (travou = ok));
    const retencao = prisma.$transaction(
      async (tx) => {
        await tx.produto.update({ where: { id_produto: c.idProduto }, data: { descricao: "trava" } });
        travou();
        await espera;
      },
      { timeout: 30000 },
    );
    await pronto;
    let liberacao = new Date(0);
    let criada: RespostaApi;
    try {
      const criacao = chamarApi(servidor, "POST", "/lotes", c.operador, {
        numero_lote: `${c.prefixo}-inicial`,
        id_produto: c.idProduto,
        id_localizacao: c.idLocalizacao,
        quantidade: "5",
      });
      await esperar(400);
      liberacao = await relogioDoBanco();
      soltar();
      await retencao;
      criada = await criacao;
    } finally {
      soltar();
      await retencao;
    }
    assert.equal(criada.status, 201);
    const idLote = (criada.corpo as { id_lote: number }).id_lote;
    const [entrada] = await c.movimentos(idLote);
    assert.ok((entrada?.data_movimentacao.getTime() ?? 0) >= liberacao.getTime() - 1);
  });
});
