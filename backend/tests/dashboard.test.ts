import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { alertasDeEstoqueMinimo, calcularIndicadores, movimentacoesPorDiaETipo } from "../src/services/dashboard.service.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";

type Resposta = {
  indicadores: Record<string, number>;
  grafico: { dia: string; tipo: string; total: number }[];
  alertas_estoque_minimo: { total: number; itens: { id_produto: number; nome: string; estoque_minimo: string; saldo_ativo: string }[] };
};

describe("dashboard (A20, RF11, RN09)", () => {
  let servidor: Servidor;
  let c: Cenario;
  let p1: number;
  let p2: number;
  let p3: number;
  let p4: number;
  let lote1: number;
  let lote4: number;
  let escopo: { idsDeProduto: number[] };

  const novoProduto = async (nome: string, minimo: string, ativo = true): Promise<number> =>
    (await prisma.produto.create({ data: { nome: `${c.prefixo}-${nome}`, unidade_medida: "UN", estoque_minimo: minimo, ativo } })).id_produto;
  const loteDe = async (produto: number, sufixo: string, quantidade: string): Promise<number> => {
    const r = await chamarApi(servidor, "POST", "/lotes", c.operador, {
      numero_lote: `${c.prefixo}-${sufixo}`,
      id_produto: produto,
      id_localizacao: c.idLocalizacao,
      quantidade,
    });
    assert.equal(r.status, 201, r.texto);
    return (r.corpo as { id_lote: number }).id_lote;
  };

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "DA");
    p1 = await novoProduto("p1", "900000000");
    p2 = await novoProduto("p2", "0");
    p3 = await novoProduto("p3", "10", false);
    p4 = await novoProduto("p4", "5");
    escopo = { idsDeProduto: [p1, p2, p3, p4] };
    lote1 = await loteDe(p1, "l1", "10");
    const bloqueado = await loteDe(p1, "l2", "500");
    await chamarApi(servidor, "POST", `/lotes/${bloqueado}/bloquear`, c.operador, { motivo: "dashboard" });
    await loteDe(p1, "l3", "0");
    lote4 = await loteDe(p2, "l4", "5");
    await prisma.lote.update({ where: { id_lote: lote4 }, data: { status_lote: "vencido" } });
    assert.equal(
      (await chamarApi(servidor, "POST", "/inventario/contagens", c.operador, { id_lote: lote1, quantidade_contada: 8 })).status,
      201,
    );
    assert.equal(
      (await chamarApi(servidor, "POST", "/inventario/contagens", c.operador, { id_lote: lote4, quantidade_contada: 5 })).status,
      201,
    );
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await prisma.produto.updateMany({ where: { nome: { startsWith: c.prefixo } }, data: { ativo: false } });
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("os seis indicadores, calculados sobre os dados do próprio teste", async () => {
    const indicadores = await calcularIndicadores(escopo);
    assert.deepEqual(indicadores, {
      produtos: 3,
      lotes: 1,
      vencidos: 1,
      bloqueados: 1,
      movimentacoes: 3,
      divergencias: 1,
    });
  });

  it("indicadores reagem às mudanças: lote ativo novo, bloqueio e contagem sem divergência", async () => {
    const extra = await loteDe(p2, "l5", "7");
    let indicadores = await calcularIndicadores(escopo);
    assert.equal(indicadores.lotes, 2);
    assert.equal(indicadores.movimentacoes, 4);
    await chamarApi(servidor, "POST", `/lotes/${extra}/bloquear`, c.operador, { motivo: "dashboard" });
    indicadores = await calcularIndicadores(escopo);
    assert.equal(indicadores.lotes, 1);
    assert.equal(indicadores.bloqueados, 2);
    const contagemIgual = await chamarApi(servidor, "POST", "/inventario/contagens", c.operador, { id_lote: extra, quantidade_contada: 7 });
    assert.equal(contagemIgual.status, 201);
    assert.equal((await calcularIndicadores(escopo)).divergencias, 1);
  });

  it("gráfico: movimentações concluídas por dia e tipo; pendentes de inventário não entram", async () => {
    const ponto = await movimentacoesPorDiaETipo(escopo);
    const hoje = new Date().toISOString().slice(0, 10);
    const entradas = ponto.filter((p) => p.tipo === "entrada").reduce((soma, p) => soma + p.total, 0);
    assert.equal(entradas, 4);
    assert.ok(ponto.every((p) => p.tipo !== "inventario"));
    assert.ok(ponto.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.dia)));
    assert.ok(ponto.every((p) => p.dia >= new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10)));
    assert.ok(ponto.length >= 1 && typeof hoje === "string");
  });

  it("RN09: alerta só para produto ativo cuja soma dos lotes ativos é menor que o mínimo", async () => {
    const alertas = await alertasDeEstoqueMinimo(escopo);
    const porNome = new Map(alertas.itens.map((i) => [i.nome, i]));
    const alertaP1 = porNome.get(`${c.prefixo}-p1`);
    assert.equal(alertaP1?.saldo_ativo.toString(), "10");
    assert.equal(porNome.get(`${c.prefixo}-p4`)?.saldo_ativo.toString(), "0");
    assert.equal(porNome.has(`${c.prefixo}-p2`), false);
    assert.equal(porNome.has(`${c.prefixo}-p3`), false);
    assert.equal(alertas.total, 2);
    assert.equal(alertas.itens[0]?.nome, `${c.prefixo}-p1`);
  });

  it("o alerta some quando a soma dos lotes ativos alcança o mínimo", async () => {
    await prisma.produto.update({ where: { id_produto: p4 }, data: { estoque_minimo: "5" } });
    await loteDe(p4, "l6", "5");
    const alertas = await alertasDeEstoqueMinimo(escopo);
    assert.equal(alertas.itens.some((i) => i.id_produto === p4), false);
    assert.equal(alertas.itens.some((i) => i.id_produto === p1), true);
  });

  it("GET /dashboard: ambos os perfis, forma da resposta, contagens inteiras e o alerta do próprio produto", async () => {
    for (const token of [c.operador, c.admin]) {
      const r = await chamarApi(servidor, "GET", "/dashboard", token);
      assert.equal(r.status, 200);
      const corpo = r.corpo as Resposta;
      assert.deepEqual(Object.keys(corpo.indicadores).sort(), ["bloqueados", "divergencias", "lotes", "movimentacoes", "produtos", "vencidos"]);
      for (const valor of Object.values(corpo.indicadores)) assert.ok(Number.isInteger(valor) && valor >= 0);
      assert.ok(Array.isArray(corpo.grafico));
      const meu = corpo.alertas_estoque_minimo.itens.find((i) => i.id_produto === p1);
      assert.equal(meu?.saldo_ativo, "10");
      assert.equal(meu?.estoque_minimo, "900000000");
      assert.ok(corpo.alertas_estoque_minimo.itens.length <= 100);
    }
    assert.equal((await chamarApi(servidor, "GET", "/dashboard")).status, 401);
    for (const metodo of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal((await chamarApi(servidor, metodo, "/dashboard", c.admin, metodo === "DELETE" ? undefined : {})).status, 404);
    }
  });
});
