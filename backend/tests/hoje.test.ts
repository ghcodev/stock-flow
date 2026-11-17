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

const inicioDoDia = async (instante: string): Promise<string> => {
  const [linha] = await prisma.$queryRaw<{ t: string }[]>`
    SELECT to_char((hoje_operacional(${instante}::timestamptz)::timestamp AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS t`;
  return linha?.t ?? "";
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

  it("usa as regras do tzdata: horário de verão de 2018/2019 (UTC-2) e a volta ao UTC-3", async () => {
    assert.equal(await dia("2019-01-15 01:59:59+00"), "2019-01-14");
    assert.equal(await dia("2019-01-15 02:00:00+00"), "2019-01-15");
    assert.equal(await dia("2019-02-16 02:59:59+00"), "2019-02-16");
    assert.equal(await dia("2019-02-17 01:59:59+00"), "2019-02-16");
    assert.equal(await dia("2019-02-17 02:59:59+00"), "2019-02-16");
    assert.equal(await dia("2019-02-17 03:00:00+00"), "2019-02-17");
    assert.equal(await dia("2018-11-04 02:59:59+00"), "2018-11-03");
    assert.equal(await dia("2018-11-04 03:00:00+00"), "2018-11-04");
    assert.equal(await inicioDoDia("2019-01-15 12:00:00+00"), "2019-01-15T02:00:00Z");
    assert.equal(await inicioDoDia("2019-07-15 12:00:00+00"), "2019-07-15T03:00:00Z");
  });

  it("janela do dia no dashboard e no gráfico começa e termina à meia-noite de São Paulo, com instante fixo", async () => {
    const instante = new Date("2026-11-17T02:30:00Z");
    assert.equal(await diaDeReferencia(instante), "2026-11-16");
    const lote = await c.novoLote("a");
    const escopo = { idsDeProduto: [c.idProduto] };
    const inicio = new Date("2026-11-16T03:00:00Z");
    const fim = new Date("2026-11-17T03:00:00Z");
    assert.equal(await inicioDoDia(instante.toISOString()), inicio.toISOString().replace(".000Z", "Z"));
    const instantes = [new Date(inicio.getTime() - 1000), inicio, new Date(fim.getTime() - 1000), fim];
    for (const [i, momento] of instantes.entries()) {
      await prisma.$executeRaw`
        INSERT INTO movimentacao (tipo_movimentacao, data_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario, id_localizacao_destino)
        VALUES ('entrada'::tipo_movimentacao, ${momento}::timestamptz, 1, ${i}, ${i + 1}, ${lote}, ${c.operadorUsuario.id}, ${c.idLocalizacao})`;
    }
    await prisma.lote.update({ where: { id_lote: lote }, data: { quantidade: instantes.length } });
    await c.verificarInvariante(lote);
    assert.equal((await calcularIndicadores(escopo, instante)).movimentacoes, 2);
    const grafico = await movimentacoesPorDiaETipo(escopo, instante);
    const porDia = new Map(grafico.map((p) => [p.dia, p.total]));
    assert.equal(porDia.get("2026-11-15"), 1);
    assert.equal(porDia.get("2026-11-16"), 2);
    assert.equal(porDia.has("2026-11-17"), false);
    assert.equal(grafico.reduce((soma, p) => soma + p.total, 0), 3);
  });
});
