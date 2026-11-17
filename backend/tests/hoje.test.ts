import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { calcularIndicadores, diaDeReferencia, movimentacoesPorDiaETipo } from "../src/services/dashboard.service.ts";
import { subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";

const dia = async (instante: string): Promise<string> => {
  const [linha] = await prisma.$queryRaw<{ d: string }[]>`SELECT to_char(hoje_operacional(${instante}::timestamptz), 'YYYY-MM-DD') AS d`;
  return linha?.d ?? "";
};

const MARGEM_DA_MEIA_NOITE_S = 30;

const esperarVirarODia = async (): Promise<void> => {
  const [linha] = await prisma.$queryRaw<{ falta: number }[]>`
    SELECT extract(epoch FROM (((hoje_operacional() + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') - now()))::float8 AS falta`;
  const falta = linha?.falta ?? Number.POSITIVE_INFINITY;
  if (falta < MARGEM_DA_MEIA_NOITE_S) await new Promise((resolver) => setTimeout(resolver, (falta + 1) * 1000));
};

describe("dia operacional de America/Sao_Paulo (hoje_operacional)", () => {
  let servidor: Servidor;
  let c: Cenario;

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "HO");
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
  });

  it("segue o dia de São Paulo, não o de UTC, inclusive entre 21h e 24h", async () => {
    assert.equal(await dia("2026-11-17 01:30:00+00"), "2026-11-16");
    assert.equal(await dia("2026-11-17 02:59:59+00"), "2026-11-16");
    assert.equal(await dia("2026-11-17 03:00:00+00"), "2026-11-17");
    assert.equal(await dia("2026-11-17 12:00:00+00"), "2026-11-17");
    const [utc] = await prisma.$queryRaw<{ d: string }[]>`SELECT to_char(('2026-11-17 01:30:00+00'::timestamptz AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS d`;
    assert.notEqual(utc?.d, await dia("2026-11-17 01:30:00+00"));
  });

  it("sem argumento é o dia de hoje em São Paulo e é o data_referencia do dashboard", async () => {
    await esperarVirarODia();
    const [agora] = await prisma.$queryRaw<{ d: string }[]>`SELECT to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS d`;
    assert.equal(await diaDeReferencia(), agora?.d);
  });

  it("janela do dia no dashboard e no gráfico começa e termina à meia-noite de São Paulo", async () => {
    await esperarVirarODia();
    const lote = await c.novoLote("a");
    const escopo = { idsDeProduto: [c.idProduto] };
    const antesIndicadores = (await calcularIndicadores(escopo)).movimentacoes;
    const antesGrafico = (await movimentacoesPorDiaETipo(escopo)).reduce((soma, p) => soma + p.total, 0);
    const [limites] = await prisma.$queryRaw<{ inicio: Date; fim: Date }[]>`
      SELECT (hoje_operacional()::timestamp AT TIME ZONE 'America/Sao_Paulo') AS inicio,
             ((hoje_operacional() + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') AS fim`;
    assert.ok(limites);
    const instantes = [
      new Date(limites.inicio.getTime() - 1000),
      limites.inicio,
      new Date(limites.fim.getTime() - 1000),
      limites.fim,
    ];
    for (const [i, instante] of instantes.entries()) {
      await prisma.$executeRaw`
        INSERT INTO movimentacao (tipo_movimentacao, data_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario, id_localizacao_destino)
        VALUES ('entrada'::tipo_movimentacao, ${instante}::timestamptz, 1, ${i}, ${i + 1}, ${lote}, ${c.operadorUsuario.id}, ${c.idLocalizacao})`;
    }
    await prisma.lote.update({ where: { id_lote: lote }, data: { quantidade: instantes.length } });
    await c.verificarInvariante(lote);
    assert.equal((await calcularIndicadores(escopo)).movimentacoes, antesIndicadores + 2);
    assert.equal((await movimentacoesPorDiaETipo(escopo)).reduce((soma, p) => soma + p.total, 0), antesGrafico + 3);
    const hoje = await diaDeReferencia();
    const porDia = new Map((await movimentacoesPorDiaETipo(escopo)).map((p) => [p.dia, p.total]));
    assert.ok((porDia.get(hoje) ?? 0) >= 2);
  });
});
