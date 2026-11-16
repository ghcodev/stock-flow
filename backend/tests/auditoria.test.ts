import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { Prisma } from "../src/generated/prisma/client.ts";
import { consultaDeAuditoria } from "../src/services/auditoria.service.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";

type Registro = {
  id_log: string;
  tabela_afetada: string;
  operacao: string;
  valor_anterior: Record<string, unknown> | null;
  valor_novo: Record<string, unknown> | null;
  id_usuario: number | null;
  data_hora: string;
  ip_usuario: string | null;
};
type Pagina = { dados: Registro[]; pagina: number; limite: number; total: number; proximo_antes_de_id: string | null };

describe("auditoria somente leitura (A18, RF13)", () => {
  let servidor: Servidor;
  let c: Cenario;
  let lote: number;
  let emailCriado: string;

  const consultar = async (consulta: string, token = c.admin): Promise<Pagina> => {
    const r = await chamarApi(servidor, "GET", `/auditoria?${consulta}`, token);
    assert.equal(r.status, 200, `${consulta} ${r.texto}`);
    return r.corpo as Pagina;
  };
  const json = (objeto: unknown): string => encodeURIComponent(JSON.stringify(objeto));

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "AU");
    lote = await c.novoLote("a", { quantidade: "10" });
    const bloqueio = await chamarApi(servidor, "POST", `/lotes/${lote}/bloquear`, c.admin, { motivo: "auditoria" });
    assert.equal(bloqueio.status, 200);
    emailCriado = `au-${randomUUID().slice(0, 8)}@teste.local`;
    const usuario = await chamarApi(servidor, "POST", "/usuarios", c.admin, {
      nome: "Auditado",
      email: emailCriado,
      senha: "senha-longa-ok",
      perfil: "operador",
    });
    assert.equal(usuario.status, 201);
    await prisma.usuario.updateMany({ where: { email: emailCriado }, data: { ativo: false } });
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("só o administrador consulta (operador 403, sem token 401) e não existe rota de escrita", async () => {
    assert.equal((await chamarApi(servidor, "GET", "/auditoria", c.operador)).status, 403);
    assert.equal((await chamarApi(servidor, "GET", "/auditoria")).status, 401);
    for (const metodo of ["POST", "PUT", "PATCH", "DELETE"]) {
      for (const caminho of ["/auditoria", "/auditoria/1"]) {
        const r = await chamarApi(servidor, metodo, caminho, c.admin, metodo === "DELETE" ? undefined : {});
        assert.ok(r.status === 404 || r.status === 403, `${metodo} ${caminho} ${r.status}`);
        assert.notEqual(r.status, 200);
      }
    }
  });

  it("filtros por usuário, tabela e operação, com conteúdo @> tipado (número como número)", async () => {
    const insercao = await consultar(
      `tabela=lote&operacao=INSERT&id_usuario=${c.operadorUsuario.id}&valor_novo=${json({ id_lote: lote })}`,
    );
    assert.equal(insercao.total, 1);
    assert.equal(insercao.dados[0]?.id_usuario, c.operadorUsuario.id);
    assert.equal(insercao.dados[0]?.operacao, "INSERT");
    assert.equal(insercao.dados[0]?.valor_anterior, null);
    assert.equal(typeof insercao.dados[0]?.id_log, "string");
    const textoNoLugarDeNumero = await consultar(`tabela=lote&valor_novo=${json({ id_lote: String(lote) })}`);
    assert.equal(textoNoLugarDeNumero.total, 0);
    const bloqueio = await consultar(
      `tabela=lote&operacao=UPDATE&id_usuario=${c.adminUsuario.id}&valor_anterior=${json({ id_lote: lote, status_lote: "ativo" })}&valor_novo=${json({ status_lote: "bloqueado" })}`,
    );
    assert.equal(bloqueio.total, 1);
    assert.equal(bloqueio.dados[0]?.valor_novo?.["status_lote"], "bloqueado");
    const movimentacoes = await consultar(`tabela=movimentacao&valor_novo=${json({ id_lote: lote })}`);
    assert.equal(movimentacoes.total, 1);
    const doOperadorNoLote = await consultar(`id_usuario=${c.operadorUsuario.id}&valor_novo=${json({ id_lote: lote })}`);
    assert.equal(doOperadorNoLote.total, 2);
    const doAdminNoLote = await consultar(`id_usuario=${c.adminUsuario.id}&valor_novo=${json({ id_lote: lote })}`);
    assert.equal(doAdminNoLote.total, 1);
  });

  it("filtro por IP e por período (instante e dia, limites inclusivo e exclusivo)", async () => {
    const base = await consultar(`tabela=lote&operacao=INSERT&valor_novo=${json({ id_lote: lote })}`);
    const registro = base.dados[0];
    assert.ok(registro?.ip_usuario);
    const mesmoIp = await consultar(`ip=${encodeURIComponent(registro.ip_usuario)}&valor_novo=${json({ id_lote: lote })}`);
    assert.ok(mesmoIp.total >= 3);
    assert.equal((await consultar(`ip=203.0.113.9&valor_novo=${json({ id_lote: lote })}`)).total, 0);

    const instante = new Date(registro.data_hora);
    const escopo = `tabela=lote&operacao=INSERT&valor_novo=${json({ id_lote: lote })}`;
    const iso = (ms: number): string => encodeURIComponent(new Date(ms).toISOString());
    assert.equal((await consultar(`${escopo}&de=${iso(instante.getTime())}&ate=${iso(instante.getTime())}`)).total, 1);
    assert.equal((await consultar(`${escopo}&de=${iso(instante.getTime() + 1)}`)).total, 0);
    assert.equal((await consultar(`${escopo}&ate=${iso(instante.getTime() - 1)}`)).total, 0);
    const dia = instante.toISOString().slice(0, 10);
    assert.equal((await consultar(`${escopo}&de=${dia}&ate=${dia}`)).total, 1);
  });

  it("senha_hash nunca aparece e não pode ser usada como filtro", async () => {
    const r = await chamarApi(servidor, "GET", `/auditoria?tabela=usuario&valor_novo=${json({ email: emailCriado })}`, c.admin);
    assert.equal(r.status, 200);
    const pagina = r.corpo as Pagina;
    assert.equal(pagina.total, 2);
    assert.doesNotMatch(r.texto, /senha_hash|\$2[aby]\$/);
    assert.equal((await chamarApi(servidor, "GET", `/auditoria?valor_novo=${json({ senha_hash: "x" })}`, c.admin)).status, 400);
    assert.equal((await chamarApi(servidor, "GET", `/auditoria?valor_novo=${json({ a: { senha_hash: "x" } })}`, c.admin)).status, 400);
  });

  it("validação: tabela, operação, IP, JSON, período e cursor inválidos ou repetidos viram 400", async () => {
    const profundo = { a: { b: { c: { d: 1 } } } };
    const muitasChaves = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, i]));
    const consultas = [
      "tabela=produto",
      "tabela=lote&tabela=usuario",
      "operacao=LOGIN",
      "operacao=AJUSTE",
      "operacao=insert",
      "ip=abc",
      "ip=999.1.1.1",
      "ip=1.1.1.1&ip=2.2.2.2",
      "id_usuario=0",
      "id_usuario=x",
      "valor_novo=nao-e-json",
      `valor_novo=${json([1, 2])}`,
      `valor_novo=${json("texto")}`,
      `valor_novo=${json({})}`,
      `valor_novo=${json(profundo)}`,
      `valor_novo=${json(muitasChaves)}`,
      `valor_anterior=${json({ texto: "x".repeat(101) })}`,
      `valor_novo=${encodeURIComponent(`{"a":"${"x".repeat(600)}"}`)}`,
      `valor_novo=${json({ a: 1 })}&valor_novo=${json({ b: 2 })}`,
      `valor_novo=${encodeURIComponent('{"a":"x\u0000"}')}`,
      "de=ontem",
      "de=2026-11-16&ate=2026-11-15",
      "antes_de_id=0",
      "antes_de_id=abc",
      "antes_de_id=1&antes_de_id=2",
      "limite=101",
      "pagina=0",
    ];
    for (const consulta of consultas) {
      assert.equal((await chamarApi(servidor, "GET", `/auditoria?${consulta}`, c.admin)).status, 400, consulta);
    }
  });

  it("paginação por cursor percorre todos os registros do filtro sem repetir nem pular", async () => {
    const filtro = `valor_novo=${json({ id_lote: lote })}`;
    const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM auditoria_log WHERE valor_novo @> ${JSON.stringify({ id_lote: lote })}::jsonb`;
    const esperados = await prisma.$queryRaw<{ id_log: bigint }[]>`SELECT id_log FROM auditoria_log WHERE valor_novo @> ${JSON.stringify({ id_lote: lote })}::jsonb ORDER BY id_log DESC`;
    assert.ok(Number(n) >= 3);
    const lidos: string[] = [];
    let cursor: string | null = null;
    let voltas = 0;
    do {
      const pagina: Pagina = await consultar(`${filtro}&limite=1${cursor === null ? "" : `&antes_de_id=${cursor}`}`);
      assert.ok(pagina.dados.length <= 1);
      lidos.push(...pagina.dados.map((d) => d.id_log));
      cursor = pagina.proximo_antes_de_id;
      voltas += 1;
    } while (cursor !== null && voltas < 20);
    assert.deepEqual(lidos, esperados.map((e) => e.id_log.toString()));
    const primeira = await consultar(`${filtro}&limite=2`);
    assert.equal(primeira.total, Number(n));
    for (let i = 1; i < primeira.dados.length; i++) {
      assert.ok(BigInt(primeira.dados[i - 1]?.id_log ?? 0) > BigInt(primeira.dados[i]?.id_log ?? 0));
    }
  });

  it("G7: a ordenação é numérica por id_log (não pelo texto do alias): primeira página sem filtro traz o maior id do banco", async () => {
    const maximo = async (): Promise<bigint> => {
      const [linha] = await prisma.$queryRaw<{ m: bigint }[]>`SELECT max(id_log) AS m FROM auditoria_log`;
      return linha?.m ?? 0n;
    };
    const antes = await maximo();
    const pagina = await consultar("limite=100");
    const depois = await maximo();
    const ids = pagina.dados.map((d) => BigInt(d.id_log));
    assert.ok((ids[0] ?? 0n) >= antes && (ids[0] ?? 0n) <= depois, `primeiro id ${ids[0]} fora de [${antes}, ${depois}]`);
    for (let i = 1; i < ids.length; i++) assert.ok((ids[i - 1] ?? 0n) > (ids[i] ?? 0n), `ordem numérica quebrada na posição ${i}`);
    assert.equal(pagina.proximo_antes_de_id, ids.at(-1)?.toString() ?? null);
  });

  it("G7: a ordem é a mesma ao atravessar 99999 e 100000 (5 e 6 dígitos)", async () => {
    const [alvo] = await prisma.$queryRaw<{ m: bigint | null }[]>`SELECT max(id_log) AS m FROM auditoria_log WHERE id_log < 100005`;
    if (alvo?.m === null || alvo?.m === undefined || alvo.m < 99000n) return;
    const pagina = await consultar("limite=10&antes_de_id=100005");
    assert.equal(pagina.dados[0]?.id_log, alvo.m.toString());
    const ids = pagina.dados.map((d) => BigInt(d.id_log));
    for (let i = 1; i < ids.length; i++) assert.ok((ids[i - 1] ?? 0n) > (ids[i] ?? 0n));
  });

  it("G7: o plano da consulta ordena por id_log numérico, nunca por (id_log)::text", async () => {
    const plano = JSON.stringify(
      await prisma.$queryRaw(Prisma.sql`EXPLAIN (FORMAT JSON) ${consultaDeAuditoria({}, 0, 20)}`),
    );
    assert.doesNotMatch(plano, /::text/);
    assert.match(plano, /auditoria_log_pkey|"Node Type":"Sort"/);
  });

  it("G7, mecanismo com valores constantes (sem tocar nos dados): alias de texto com o mesmo nome ordena como texto; qualificar a coluna ordena como número", async () => {
    const comAlias = await prisma.$queryRaw<{ id_log: string }[]>`
      SELECT v.id_log::text AS id_log FROM (VALUES (99999::bigint), (100000::bigint), (7::bigint)) AS v(id_log) ORDER BY id_log DESC`;
    assert.equal(comAlias[0]?.id_log, "99999");
    const qualificada = await prisma.$queryRaw<{ id_log: string }[]>`
      SELECT v.id_log::text AS id_log FROM (VALUES (99999::bigint), (100000::bigint), (7::bigint)) AS v(id_log) ORDER BY v.id_log DESC`;
    assert.deepEqual(qualificada.map((l) => l.id_log), ["100000", "99999", "7"]);
  });

  it("plano: o conteúdo @> usa o GIN jsonb_path_ops e o período usa o B-tree de data_hora", async () => {
    const plano = async (filtro: Parameters<typeof consultaDeAuditoria>[0]): Promise<string> =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
        await tx.$executeRaw`SET LOCAL enable_indexscan = off`;
        const linhas = await tx.$queryRaw<{ "QUERY PLAN": unknown }[]>(
          Prisma.sql`EXPLAIN (FORMAT JSON) ${consultaDeAuditoria(filtro, 0, 20)}`,
        );
        return JSON.stringify(linhas);
      });
    assert.match(await plano({ valor_novo: JSON.stringify({ id_lote: lote }) }), /idx_auditoria_novo/);
    assert.match(await plano({ valor_anterior: JSON.stringify({ id_lote: lote }) }), /idx_auditoria_anterior/);
    assert.match(await plano({ de: "2026-01-01", ate: "2026-01-02" }), /idx_auditoria_data_hora/);
  });
});
