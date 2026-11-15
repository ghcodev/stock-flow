import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario, type Mov } from "./movimentacao.apoio.ts";

describe("entrada (A11, RF03)", () => {
  let servidor: Servidor;
  let c: Cenario;

  const entrada = (corpo: unknown, token = c.operador) => chamarApi(servidor, "POST", "/movimentacoes/entrada", token, corpo);

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "EN");
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("operador e administrador registram entrada: saldos anterior e posterior, destino, usuário e textos", async () => {
    const lote = await c.novoLote("a", { quantidade: "10" });
    const r = await entrada({ id_lote: lote, quantidade: 5.5, motivo: "Reposição", observacao: "NF 123" });
    assert.equal(r.status, 201);
    const m = r.corpo as Mov;
    assert.equal(typeof m.id_movimentacao, "string");
    assert.equal(m.tipo_movimentacao, "entrada");
    assert.equal(m.quantidade, "5.5");
    assert.equal(m.saldo_anterior, "10");
    assert.equal(m.saldo_posterior, "15.5");
    assert.equal(m.id_usuario, c.operadorUsuario.id);
    assert.equal(m.id_localizacao_destino, c.idLocalizacao);
    assert.equal(m.id_localizacao_origem, null);
    assert.equal(m.motivo_movimentacao, "Reposição");
    assert.equal(m.status_movimentacao, "concluida");
    assert.equal(await c.saldoDo(lote), "15.5");
    const admin = await entrada({ id_lote: lote, quantidade: "0.500" }, c.admin);
    assert.equal(admin.status, 201);
    assert.equal(await c.saldoDo(lote), "16");
    await c.verificarInvariante(lote);
  });

  it("a entrada inicial criada com o lote não é contada duas vezes", async () => {
    const lote = await c.novoLote("b", { quantidade: "10" });
    assert.equal((await entrada({ id_lote: lote, quantidade: 5 })).status, 201);
    assert.equal(await c.saldoDo(lote), "15");
    const lista = await c.movimentos(lote);
    assert.equal(lista.length, 2);
    const soma = lista.reduce((total, m) => total + Number(m.quantidade.toString()), 0);
    assert.equal(soma, 15);
    await c.verificarInvariante(lote);
  });

  it("lote sem entrada inicial (saldo 0): a primeira movimentação parte de 0", async () => {
    const lote = await c.novoLote("c");
    const r = await entrada({ id_lote: lote, quantidade: "0.001" });
    assert.equal((r.corpo as Mov).saldo_anterior, "0");
    assert.equal(await c.saldoDo(lote), "0.001");
    await c.verificarInvariante(lote);
  });

  it("auditoria: UPDATE do lote e INSERT da movimentação com o id_usuario do token", async () => {
    const lote = await c.novoLote("d", { quantidade: "1" });
    const r = await entrada({ id_lote: lote, quantidade: 1 });
    const id = (r.corpo as Mov).id_movimentacao;
    const linhas = await prisma.$queryRaw<{ tabela_afetada: string; id_usuario: number | null }[]>`
      SELECT tabela_afetada, id_usuario FROM auditoria_log
      WHERE (tabela_afetada = 'lote' AND operacao = 'UPDATE' AND (valor_novo->>'id_lote')::int = ${lote})
         OR (tabela_afetada = 'movimentacao' AND (valor_novo->>'id_movimentacao')::bigint = ${BigInt(id)})
      ORDER BY id_log`;
    assert.deepEqual(linhas.map((l) => l.tabela_afetada), ["lote", "movimentacao"]);
    assert.ok(linhas.every((l) => l.id_usuario === c.operadorUsuario.id));
  });

  it("validação: quantidade, lote, textos e tipos viram 400, nunca 500", async () => {
    const lote = await c.novoLote("e", { quantidade: "1" });
    const casos: unknown[] = [
      {},
      { id_lote: lote },
      { quantidade: 1 },
      { id_lote: lote, quantidade: 0 },
      { id_lote: lote, quantidade: "0.000" },
      { id_lote: lote, quantidade: -1 },
      { id_lote: lote, quantidade: "abc" },
      { id_lote: lote, quantidade: "1e3" },
      { id_lote: lote, quantidade: 1.2345 },
      { id_lote: lote, quantidade: "9999999999" },
      { id_lote: lote, quantidade: [1] },
      { id_lote: lote, quantidade: { v: 1 } },
      { id_lote: [lote], quantidade: 1 },
      { id_lote: "x", quantidade: 1 },
      { id_lote: 0, quantidade: 1 },
      { id_lote: lote, quantidade: 1, motivo: "a\u0000b" },
      { id_lote: lote, quantidade: 1, motivo: "m".repeat(256) },
      { id_lote: lote, quantidade: 1, observacao: ["x"] },
    ];
    for (const corpo of casos) {
      const r = await entrada(corpo);
      assert.equal(r.status, 400, JSON.stringify(corpo));
    }
    assert.equal(await c.saldoDo(lote), "1");
  });

  it("lote inexistente 404; sem token 401; id_usuario do corpo é ignorado", async () => {
    assert.equal((await entrada({ id_lote: 2_000_000_000, quantidade: 1 })).status, 404);
    assert.equal((await chamarApi(servidor, "POST", "/movimentacoes/entrada", undefined, { id_lote: 1, quantidade: 1 })).status, 401);
    const lote = await c.novoLote("f", { quantidade: "1" });
    const r = await entrada({ id_lote: lote, quantidade: 1, id_usuario: 1, tipo_movimentacao: "saida", saldo_posterior: "999" });
    const m = r.corpo as Mov;
    assert.equal(m.id_usuario, c.operadorUsuario.id);
    assert.equal(m.tipo_movimentacao, "entrada");
    assert.equal(m.saldo_posterior, "2");
  });

  it("saldo acima do limite NUMERIC(12,3) é 422 e nada muda", async () => {
    const lote = await c.novoLote("g", { quantidade: "999999999.000" });
    const r = await entrada({ id_lote: lote, quantidade: 1 });
    assert.equal(r.status, 422);
    assert.equal((r.corpo as { erro: { codigo: string } }).erro.codigo, "SALDO_EXCEDE_LIMITE");
    assert.equal(await c.saldoDo(lote), "999999999");
    assert.equal((await c.movimentos(lote)).length, 1);
  });

  it("a especificação só restringe saída: entrada é aceita em lote bloqueado e vencido", async () => {
    const lote = await c.novoLote("h", { quantidade: "1", data_validade: "2000-01-01" });
    await chamarApi(servidor, "POST", `/lotes/${lote}/bloquear`, c.operador, { motivo: "teste" });
    assert.equal((await entrada({ id_lote: lote, quantidade: 1 })).status, 201);
    assert.equal(await c.saldoDo(lote), "2");
    await c.verificarInvariante(lote);
  });

  it("dez entradas simultâneas somam exatamente e a cadeia de saldos não tem buraco", async () => {
    const lote = await c.novoLote("i", { quantidade: "100" });
    const respostas = await Promise.all(Array.from({ length: 10 }, () => entrada({ id_lote: lote, quantidade: 1 })));
    const status = respostas.map((r) => r.status);
    assert.ok(status.every((s) => s === 201 || s === 409), status.join(","));
    const aceitas = status.filter((s) => s === 201).length;
    assert.equal(await c.saldoDo(lote), String(100 + aceitas));
    await c.verificarInvariante(lote);
  });
});
