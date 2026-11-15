import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario, type Mov } from "./movimentacao.apoio.ts";

type ErroApi = { erro: { codigo: string } };

describe("transferência (A13, RF05, RN12, RN13)", () => {
  let servidor: Servidor;
  let c: Cenario;
  let idTerceira: number;

  const transferir = (corpo: unknown, token = c.operador) =>
    chamarApi(servidor, "POST", "/movimentacoes/transferencia", token, corpo);
  const localizacaoDo = async (idLote: number): Promise<number> =>
    (await prisma.lote.findUniqueOrThrow({ where: { id_lote: idLote } })).id_localizacao;

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "TR");
    idTerceira = (await prisma.localizacao.create({ data: { corredor: c.prefixo, nivel: "1", posicao: "C" } })).id_localizacao;
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("move o lote inteiro: localização muda, saldo não muda, origem e destino gravados", async () => {
    const lote = await c.novoLote("a", { quantidade: "12.5" });
    const r = await transferir({ id_lote: lote, id_localizacao_destino: c.idOutraLocalizacao, motivo: "Reorganização", observacao: "corredor B" });
    assert.equal(r.status, 201);
    const m = r.corpo as Mov;
    assert.equal(m.tipo_movimentacao, "transferencia");
    assert.equal(m.id_localizacao_origem, c.idLocalizacao);
    assert.equal(m.id_localizacao_destino, c.idOutraLocalizacao);
    assert.equal(m.quantidade, "12.5");
    assert.equal(m.saldo_anterior, "12.5");
    assert.equal(m.saldo_posterior, "12.5");
    assert.equal(m.motivo_movimentacao, "Reorganização");
    assert.equal(m.id_usuario, c.operadorUsuario.id);
    assert.equal(await localizacaoDo(lote), c.idOutraLocalizacao);
    assert.equal(await c.saldoDo(lote), "12.5");
    await c.verificarInvariante(lote);
    const admin = await transferir({ id_lote: lote, id_localizacao_destino: c.idLocalizacao, motivo: "Volta" }, c.admin);
    assert.equal(admin.status, 201);
    assert.equal(await localizacaoDo(lote), c.idLocalizacao);
  });

  it("RN13: destino igual à origem ou inexistente é 422 e nada muda", async () => {
    const lote = await c.novoLote("b", { quantidade: "3" });
    const igual = await transferir({ id_lote: lote, id_localizacao_destino: c.idLocalizacao, motivo: "x" });
    assert.equal(igual.status, 422);
    assert.equal((igual.corpo as ErroApi).erro.codigo, "DESTINO_IGUAL_ORIGEM");
    const inexistente = await transferir({ id_lote: lote, id_localizacao_destino: 2_000_000_000, motivo: "x" });
    assert.equal(inexistente.status, 422);
    assert.equal((inexistente.corpo as ErroApi).erro.codigo, "LOCALIZACAO_INVALIDA");
    assert.equal(await localizacaoDo(lote), c.idLocalizacao);
    assert.equal((await c.movimentos(lote)).length, 1);
  });

  it("RF05: só lote ativo é transferido (bloqueado e vencido recebem 422); lote sem saldo também", async () => {
    const bloqueado = await c.novoLote("c1", { quantidade: "3" });
    await chamarApi(servidor, "POST", `/lotes/${bloqueado}/bloquear`, c.operador, { motivo: "teste" });
    const vencido = await c.novoLote("c2", { quantidade: "3" });
    await prisma.lote.update({ where: { id_lote: vencido }, data: { status_lote: "vencido" } });
    const vazio = await c.novoLote("c3");
    for (const lote of [bloqueado, vencido, vazio]) {
      const r = await transferir({ id_lote: lote, id_localizacao_destino: c.idOutraLocalizacao, motivo: "x" });
      assert.equal(r.status, 422, String(lote));
      assert.equal(await localizacaoDo(lote), c.idLocalizacao);
    }
  });

  it("justificativa obrigatória e demais validações: 400", async () => {
    const lote = await c.novoLote("d", { quantidade: "1" });
    const base = { id_lote: lote, id_localizacao_destino: c.idOutraLocalizacao, motivo: "ok" };
    const casos: unknown[] = [
      {},
      { ...base, motivo: undefined },
      { ...base, motivo: "" },
      { ...base, motivo: "   " },
      { ...base, motivo: ["a"] },
      { ...base, motivo: "a\u0000" },
      { ...base, motivo: "m".repeat(256) },
      { ...base, id_localizacao_destino: undefined },
      { ...base, id_localizacao_destino: "x" },
      { ...base, id_localizacao_destino: [1] },
      { ...base, id_lote: { a: 1 } },
    ];
    for (const corpo of casos) assert.equal((await transferir(corpo)).status, 400, JSON.stringify(corpo));
    assert.equal(await localizacaoDo(lote), c.idLocalizacao);
  });

  it("lote inexistente 404; sem token 401; usuário do corpo ignorado", async () => {
    assert.equal((await transferir({ id_lote: 2_000_000_000, id_localizacao_destino: c.idOutraLocalizacao, motivo: "x" })).status, 404);
    assert.equal((await chamarApi(servidor, "POST", "/movimentacoes/transferencia", undefined, {})).status, 401);
    const lote = await c.novoLote("e", { quantidade: "1" });
    const m = (await transferir({ id_lote: lote, id_localizacao_destino: c.idOutraLocalizacao, motivo: "x", id_usuario: 1 })).corpo as Mov;
    assert.equal(m.id_usuario, c.operadorUsuario.id);
  });

  it("duas transferências simultâneas do mesmo lote: ambas aplicam em série e a origem da segunda é o destino da primeira", async () => {
    const lote = await c.novoLote("f", { quantidade: "4" });
    const respostas = await Promise.all([
      transferir({ id_lote: lote, id_localizacao_destino: c.idOutraLocalizacao, motivo: "a" }),
      transferir({ id_lote: lote, id_localizacao_destino: idTerceira, motivo: "b" }, c.admin),
    ]);
    assert.deepEqual(respostas.map((r) => r.status), [201, 201]);
    const transferencias = (await c.movimentos(lote)).filter((m) => m.tipo_movimentacao === "transferencia");
    assert.equal(transferencias.length, 2);
    assert.equal(transferencias[0]?.id_localizacao_origem, c.idLocalizacao);
    assert.equal(transferencias[1]?.id_localizacao_origem, transferencias[0]?.id_localizacao_destino);
    assert.equal(await localizacaoDo(lote), transferencias[1]?.id_localizacao_destino);
    await c.verificarInvariante(lote);
  });

  it("transferência concorrente com saída: o saldo da transferência é o do momento da trava e a cadeia fecha", async () => {
    const lote = await c.novoLote("g", { quantidade: "10" });
    const [t, s] = await Promise.all([
      transferir({ id_lote: lote, id_localizacao_destino: c.idOutraLocalizacao, motivo: "x" }),
      chamarApi(servidor, "POST", "/movimentacoes/saida", c.operador, { id_lote: lote, quantidade: 4 }),
    ]);
    assert.deepEqual([t.status, s.status], [201, 201]);
    assert.equal(await c.saldoDo(lote), "6");
    await c.verificarInvariante(lote);
  });
});
