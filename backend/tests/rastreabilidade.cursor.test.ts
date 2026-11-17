import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";

type Evento = { id_movimentacao: string };
type Resposta = { linha_do_tempo: Evento[]; proximo_depois_de_id: string | null; total: number };

const INSTANTES = [
  "2026-11-16 12:00:00.123456+00",
  "2026-11-16 12:00:00.123457+00",
  "2026-11-16 12:00:00.123999+00",
  "2026-11-16 12:00:00.123456+00",
  "2026-11-16 12:00:00.500000+00",
  "2026-11-16 12:00:00.500000+00",
  "2026-11-16 12:00:00.500000+00",
  "2026-11-16 11:59:59.999999+00",
  "2026-11-16 12:00:01.000001+00",
  "2026-11-16 12:00:00.123000+00",
  "2026-11-16 12:00:00.123456+00",
  "2026-11-16 12:00:00.123001+00",
];

describe("cursor da rastreabilidade com timestamps de microssegundo, empates e mesmo milissegundo (G8)", () => {
  let servidor: Servidor;
  let c: Cenario;
  let lote: number;
  let esperados: string[];

  const rastrear = async (consulta: string): Promise<Resposta> => {
    const r = await chamarApi(servidor, "GET", `/rastreabilidade?id_lote=${lote}&${consulta}`, c.operador);
    assert.equal(r.status, 200, r.texto);
    return r.corpo as Resposta;
  };
  const percorrer = async (limite: number): Promise<string[]> => {
    const lidos: string[] = [];
    let cursor: string | null = null;
    let voltas = 0;
    do {
      const pagina: Resposta = await rastrear(`limite=${limite}${cursor === null ? "" : `&depois_de_id=${cursor}`}`);
      assert.ok(pagina.linha_do_tempo.length <= limite);
      assert.ok(pagina.linha_do_tempo.length > 0 || pagina.proximo_depois_de_id === null);
      lidos.push(...pagina.linha_do_tempo.map((e) => e.id_movimentacao));
      cursor = pagina.proximo_depois_de_id;
      voltas += 1;
    } while (cursor !== null && voltas < 40);
    return lidos;
  };

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "CU");
    lote = await c.novoLote("a");
    const cronologica = await prisma.$queryRaw<{ i: number }[]>`
      SELECT (t.i - 1)::int AS i FROM unnest(${INSTANTES}::timestamptz[]) WITH ORDINALITY AS t(ts, i) ORDER BY t.ts, t.i`;
    const posicao = new Map(cronologica.map((linha, ordem) => [linha.i, ordem]));
    for (let i = 0; i < INSTANTES.length; i++) {
      const ordem = posicao.get(i) ?? 0;
      await prisma.$executeRaw`
        INSERT INTO movimentacao (tipo_movimentacao, data_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario, id_localizacao_destino)
        VALUES ('entrada'::tipo_movimentacao, ${INSTANTES[i]}::timestamptz, 1, ${ordem}, ${ordem + 1}, ${lote}, ${c.operadorUsuario.id}, ${c.idLocalizacao})`;
    }
    await prisma.lote.update({ where: { id_lote: lote }, data: { quantidade: INSTANTES.length } });
    await c.verificarInvariante(lote);
    const ordenados = await prisma.$queryRaw<{ id_movimentacao: bigint }[]>`
      SELECT id_movimentacao FROM movimentacao WHERE id_lote = ${lote} ORDER BY data_movimentacao, id_movimentacao`;
    esperados = ordenados.map((o) => o.id_movimentacao.toString());
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("premissa: há linhas com microssegundo, várias no mesmo milissegundo e timestamps exatamente iguais", async () => {
    const [medidas] = await prisma.$queryRaw<{ com_micro: bigint; mesmo_ms: bigint; iguais: bigint }[]>`
      SELECT count(*) FILTER (WHERE data_movimentacao <> date_trunc('milliseconds', data_movimentacao)) AS com_micro,
             count(*) - count(DISTINCT date_trunc('milliseconds', data_movimentacao)) AS mesmo_ms,
             count(*) - count(DISTINCT data_movimentacao) AS iguais
      FROM movimentacao WHERE id_lote = ${lote}`;
    assert.ok(Number(medidas?.com_micro) >= 8);
    assert.ok(Number(medidas?.mesmo_ms) >= 6);
    assert.ok(Number(medidas?.iguais) >= 4);
    assert.equal(esperados.length, INSTANTES.length);
    assert.equal(new Set(esperados).size, esperados.length);
  });

  it("mecanismo do defeito (leitura, só dados do teste): a comparação com o timestamp truncado em milissegundo erra em pelo menos uma linha, a tupla no banco não", async () => {
    let divergencias = 0;
    for (let i = 0; i < esperados.length; i++) {
      const truncada = await prisma.$queryRaw<{ id_movimentacao: bigint }[]>`
        SELECT m.id_movimentacao FROM movimentacao m, movimentacao r
        WHERE m.id_lote = ${lote} AND r.id_movimentacao = ${BigInt(esperados[i] ?? "0")}
          AND (m.data_movimentacao > date_trunc('milliseconds', r.data_movimentacao)
               OR (m.data_movimentacao = date_trunc('milliseconds', r.data_movimentacao) AND m.id_movimentacao > r.id_movimentacao))
        ORDER BY m.data_movimentacao, m.id_movimentacao`;
      const lidas = truncada.map((l) => l.id_movimentacao.toString());
      if (JSON.stringify(lidas) !== JSON.stringify(esperados.slice(i + 1))) divergencias += 1;
      const exata = await prisma.$queryRaw<{ id_movimentacao: bigint }[]>`
        SELECT m.id_movimentacao FROM movimentacao m
        WHERE m.id_lote = ${lote} AND (m.data_movimentacao, m.id_movimentacao) > (
          SELECT r.data_movimentacao, r.id_movimentacao FROM movimentacao r WHERE r.id_movimentacao = ${BigInt(esperados[i] ?? "0")})
        ORDER BY m.data_movimentacao, m.id_movimentacao`;
      assert.deepEqual(exata.map((l) => l.id_movimentacao.toString()), esperados.slice(i + 1));
    }
    assert.ok(divergencias >= 1, "a comparação truncada deveria divergir em alguma linha com microssegundo");
  });

  it("páginas de tamanho 1, 2, 3 e 5 pelo cursor reproduzem exatamente a ordem do banco, sem repetir nem perder", async () => {
    for (const limite of [1, 2, 3, 5]) {
      const lidos = await percorrer(limite);
      assert.deepEqual(lidos, esperados, `limite ${limite}`);
      assert.equal(new Set(lidos).size, lidos.length);
    }
  });

  it("a página por deslocamento coincide com a ordem do banco e o total é o do lote", async () => {
    const porPagina: string[] = [];
    for (let pagina = 1; pagina <= 12; pagina++) {
      const corpo = await rastrear(`limite=1&pagina=${pagina}`);
      assert.equal(corpo.total, INSTANTES.length);
      porPagina.push(...corpo.linha_do_tempo.map((e) => e.id_movimentacao));
    }
    assert.deepEqual(porPagina, esperados);
  });

  it("cursor em cada linha traz exatamente as posteriores na ordem (data, id), inclusive nos empates", async () => {
    for (let i = 0; i < esperados.length; i++) {
      const corpo = await rastrear(`limite=100&depois_de_id=${esperados[i]}`);
      assert.deepEqual(
        corpo.linha_do_tempo.map((e) => e.id_movimentacao),
        esperados.slice(i + 1),
        `depois da posição ${i}`,
      );
      assert.equal(corpo.proximo_depois_de_id, null);
    }
  });

  it("cursor de outro lote continua sendo 400", async () => {
    const outro = await c.novoLote("b", { quantidade: "1" });
    const [{ id_movimentacao }] = await prisma.$queryRaw<{ id_movimentacao: bigint }[]>`SELECT id_movimentacao FROM movimentacao WHERE id_lote = ${outro} LIMIT 1`;
    const r = await chamarApi(servidor, "GET", `/rastreabilidade?id_lote=${lote}&depois_de_id=${id_movimentacao}`, c.operador);
    assert.equal(r.status, 400);
  });
});
