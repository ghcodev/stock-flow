import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario, type Mov } from "./movimentacao.apoio.ts";

type Lista = { dados: Mov[]; pagina: number; limite: number; total: number };

describe("histórico de movimentações (A14, RF07, RN07)", () => {
  let servidor: Servidor;
  let c: Cenario;
  let lote: number;
  let loteDeOutro: number;

  const historico = async (consulta: string, token = c.operador): Promise<Lista> => {
    const r = await chamarApi(servidor, "GET", `/movimentacoes${consulta}`, token);
    assert.equal(r.status, 200, `${consulta} ${r.texto}`);
    return r.corpo as Lista;
  };
  const post = (caminho: string, corpo: unknown, token = c.operador) => chamarApi(servidor, "POST", caminho, token, corpo);

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "HI");
    lote = await c.novoLote("a", { quantidade: "20" });
    loteDeOutro = await c.novoLote("b", { quantidade: "5" });
    assert.equal((await post("/movimentacoes/entrada", { id_lote: lote, quantidade: 5 })).status, 201);
    assert.equal((await post("/movimentacoes/saida", { id_lote: lote, quantidade: 3 }, c.admin)).status, 201);
    assert.equal(
      (await post("/movimentacoes/transferencia", { id_lote: lote, id_localizacao_destino: c.idOutraLocalizacao, motivo: "x" })).status,
      201,
    );
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("lista o histórico do lote em ordem estável por data e id, incluindo a entrada inicial, com BIGINT e NUMERIC em texto", async () => {
    const r = await chamarApi(servidor, "GET", `/movimentacoes?id_lote=${lote}`, c.operador);
    const lista = r.corpo as Lista;
    assert.equal(lista.total, 4);
    assert.deepEqual(lista.dados.map((m) => m.tipo_movimentacao), ["transferencia", "saida", "entrada", "entrada"]);
    assert.equal(lista.dados[3]?.saldo_anterior, "0");
    assert.equal(lista.dados[3]?.saldo_posterior, "20");
    for (const m of lista.dados) {
      assert.equal(typeof m.id_movimentacao, "string");
      assert.equal(typeof m.quantidade, "string");
      assert.equal(typeof m.saldo_posterior, "string");
    }
    for (let i = 1; i < lista.dados.length; i++) {
      const a = lista.dados[i - 1];
      const b = lista.dados[i];
      assert.ok(a && b);
      const ordenado = a.data_movimentacao > b.data_movimentacao || (a.data_movimentacao === b.data_movimentacao && BigInt(a.id_movimentacao) > BigInt(b.id_movimentacao));
      assert.ok(ordenado, `ordem instável na posição ${i}`);
    }
    assert.match(r.texto, /"id_movimentacao":"\d+"/);
  });

  it("filtros por tipo, usuário e lote, combináveis", async () => {
    assert.equal((await historico(`?id_lote=${lote}&tipo=entrada`)).total, 2);
    assert.equal((await historico(`?id_lote=${lote}&tipo=saida`)).total, 1);
    const doAdmin = await historico(`?id_lote=${lote}`);
    const idAdmin = doAdmin.dados.find((m) => m.tipo_movimentacao === "saida")?.id_usuario;
    const porUsuario = await historico(`?id_lote=${lote}&id_usuario=${idAdmin}`);
    assert.equal(porUsuario.total, 1);
    assert.equal((await historico(`?id_lote=${loteDeOutro}`)).total, 1);
    assert.equal((await historico(`?id_lote=${lote}&tipo=ajuste`)).total, 0);
    assert.equal((await historico(`?id_lote=${lote}&id_usuario=${c.operadorUsuario.id}`)).total, 3);
  });

  it("filtro por período: instante, data inclusiva no fim e intervalo vazio", async () => {
    const agora = new Date();
    const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const hoje = agora.toISOString().slice(0, 10);
    assert.equal((await historico(`?id_lote=${lote}&de=${encodeURIComponent(ontem)}&ate=${encodeURIComponent(amanha)}`)).total, 4);
    assert.equal((await historico(`?id_lote=${lote}&de=${hoje}&ate=${hoje}`)).total, 4);
    assert.equal((await historico(`?id_lote=${lote}&ate=${encodeURIComponent(ontem)}`)).total, 0);
    assert.equal((await historico(`?id_lote=${lote}&de=${encodeURIComponent(amanha)}`)).total, 0);
  });

  it("paginação com limite máximo de 100", async () => {
    const p1 = await historico(`?id_lote=${lote}&limite=3&pagina=1`);
    const p2 = await historico(`?id_lote=${lote}&limite=3&pagina=2`);
    assert.equal(p1.dados.length, 3);
    assert.equal(p2.dados.length, 1);
    assert.equal(p1.total, 4);
    assert.equal(new Set([...p1.dados, ...p2.dados].map((m) => m.id_movimentacao)).size, 4);
    assert.equal((await chamarApi(servidor, "GET", "/movimentacoes?limite=101", c.operador)).status, 400);
    assert.equal((await historico("")).limite, 20);
  });

  it("parâmetros inválidos ou repetidos: 400", async () => {
    for (const consulta of [
      "?de=ontem",
      "?ate=2026-13-45",
      "?de=2026-05-02&ate=2026-05-01",
      "?tipo=venda",
      "?tipo=entrada&tipo=saida",
      "?id_lote=x",
      "?id_lote=1&id_lote=2",
      "?id_usuario=0",
      "?id_usuario=1&id_usuario=2",
      "?pagina=0",
      "?de=2026-01-01&de=2026-01-02",
    ]) {
      assert.equal((await chamarApi(servidor, "GET", `/movimentacoes${consulta}`, c.operador)).status, 400, consulta);
    }
  });

  it("obter por id; inexistente 404; id inválido 400; sem token 401", async () => {
    const primeira = (await historico(`?id_lote=${lote}&limite=1`)).dados[0];
    const r = await chamarApi(servidor, "GET", `/movimentacoes/${primeira?.id_movimentacao}`, c.admin);
    assert.equal(r.status, 200);
    assert.equal((r.corpo as Mov).id_movimentacao, primeira?.id_movimentacao);
    assert.equal((await chamarApi(servidor, "GET", "/movimentacoes/999999999999", c.admin)).status, 404);
    for (const id of ["abc", "0", "-1", "1.5", "12345678901234567890"]) {
      assert.equal((await chamarApi(servidor, "GET", `/movimentacoes/${id}`, c.admin)).status, 400, id);
    }
    assert.equal((await chamarApi(servidor, "GET", "/movimentacoes")).status, 401);
  });

  it("RN07: não existe rota para excluir ou editar movimentações", async () => {
    const primeira = (await historico(`?id_lote=${lote}&limite=1`)).dados[0];
    const id = primeira?.id_movimentacao;
    for (const metodo of ["DELETE", "PUT", "PATCH"]) {
      for (const caminho of ["/movimentacoes", `/movimentacoes/${id}`]) {
        const r = await chamarApi(servidor, metodo, caminho, c.admin, metodo === "DELETE" ? undefined : { quantidade: 1 });
        assert.equal(r.status, 404, `${metodo} ${caminho}`);
      }
    }
    assert.equal(await prisma.movimentacao.count({ where: { id_movimentacao: BigInt(id ?? "0") } }), 1);
  });
});
