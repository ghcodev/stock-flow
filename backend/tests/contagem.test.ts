import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario, type Mov } from "./movimentacao.apoio.ts";

type Contagem = Mov & { divergencia: string };
type Lista = { dados: Contagem[]; pagina: number; limite: number; total: number };

describe("contagem de inventário (A15, RF15)", () => {
  let servidor: Servidor;
  let c: Cenario;

  const contar = (corpo: unknown, token = c.operador) => chamarApi(servidor, "POST", "/inventario/contagens", token, corpo);

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "CT");
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("operador e administrador registram a contagem: pendente, não altera o saldo, saldos iguais ao do sistema", async () => {
    const lote = await c.novoLote("a", { quantidade: "50" });
    const r = await contar({ id_lote: lote, quantidade_contada: "48", observacao: "Corredor 3" });
    assert.equal(r.status, 201);
    const m = r.corpo as Contagem;
    assert.equal(m.tipo_movimentacao, "inventario");
    assert.equal(m.status_movimentacao, "pendente");
    assert.equal(m.quantidade, "48");
    assert.equal(m.saldo_anterior, "50");
    assert.equal(m.saldo_posterior, "50");
    assert.equal(m.divergencia, "-2");
    assert.equal(m.id_usuario, c.operadorUsuario.id);
    assert.equal(m.id_localizacao_origem, null);
    assert.equal(m.id_localizacao_destino, null);
    assert.equal(await c.saldoDo(lote), "50");
    const outro = await c.novoLote("a2", { quantidade: "5" });
    const admin = await contar({ id_lote: outro, quantidade_contada: "7.5" }, c.admin);
    assert.equal(admin.status, 201);
    assert.equal((admin.corpo as Contagem).divergencia, "2.5");
    await c.verificarInvariante(lote);
  });

  it("contagem 0 é aceita (o CHECK só permite quantidade 0 em inventário)", async () => {
    const lote = await c.novoLote("b", { quantidade: "3" });
    const r = await contar({ id_lote: lote, quantidade_contada: 0 });
    assert.equal(r.status, 201);
    assert.equal((r.corpo as Contagem).quantidade, "0");
    assert.equal((r.corpo as Contagem).divergencia, "-3");
    assert.equal(await c.saldoDo(lote), "3");
  });

  it("segunda contagem pendente para o mesmo lote é recusada (409); outro lote segue livre", async () => {
    const lote = await c.novoLote("c", { quantidade: "10" });
    assert.equal((await contar({ id_lote: lote, quantidade_contada: 9 })).status, 201);
    const segunda = await contar({ id_lote: lote, quantidade_contada: 8 }, c.admin);
    assert.equal(segunda.status, 409);
    assert.equal((segunda.corpo as { erro: { codigo: string } }).erro.codigo, "CONTAGEM_PENDENTE_EXISTENTE");
    assert.equal(await prisma.movimentacao.count({ where: { id_lote: lote, tipo_movimentacao: "inventario" } }), 1);
    const outro = await c.novoLote("c2", { quantidade: "10" });
    assert.equal((await contar({ id_lote: outro, quantidade_contada: 9 })).status, 201);
  });

  it("duas contagens simultâneas do mesmo lote: uma vence e a outra recebe 409", async () => {
    const lote = await c.novoLote("d", { quantidade: "10" });
    const respostas = await Promise.all([
      contar({ id_lote: lote, quantidade_contada: 9 }),
      contar({ id_lote: lote, quantidade_contada: 8 }, c.admin),
    ]);
    assert.deepEqual(respostas.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await prisma.movimentacao.count({ where: { id_lote: lote, tipo_movimentacao: "inventario" } }), 1);
  });

  it("contagem concorrente com saída: grava o saldo do momento da trava e a cadeia de saldos fecha", async () => {
    const lote = await c.novoLote("e", { quantidade: "10" });
    const [r, s] = await Promise.all([
      contar({ id_lote: lote, quantidade_contada: 10 }),
      chamarApi(servidor, "POST", "/movimentacoes/saida", c.operador, { id_lote: lote, quantidade: 4 }),
    ]);
    assert.deepEqual([r.status, s.status], [201, 201]);
    const m = r.corpo as Contagem;
    assert.ok(m.saldo_anterior === "10" || m.saldo_anterior === "6", m.saldo_anterior);
    assert.equal(m.saldo_anterior, m.saldo_posterior);
    assert.equal(await c.saldoDo(lote), "6");
    await c.verificarInvariante(lote);
  });

  it("auditoria da contagem com o id_usuario do token", async () => {
    const lote = await c.novoLote("f", { quantidade: "2" });
    const m = (await contar({ id_lote: lote, quantidade_contada: 1 })).corpo as Contagem;
    const linhas = await prisma.$queryRaw<{ id_usuario: number | null; operacao: string }[]>`
      SELECT id_usuario, operacao::text AS operacao FROM auditoria_log
      WHERE tabela_afetada = 'movimentacao' AND (valor_novo->>'id_movimentacao')::bigint = ${BigInt(m.id_movimentacao)}`;
    assert.equal(linhas.length, 1);
    assert.equal(linhas[0]?.operacao, "INSERT");
    assert.equal(linhas[0]?.id_usuario, c.operadorUsuario.id);
  });

  it("a contagem pendente aparece no histórico, mas fora da cadeia de saldos", async () => {
    const lote = await c.novoLote("g", { quantidade: "10" });
    await contar({ id_lote: lote, quantidade_contada: 7 });
    await chamarApi(servidor, "POST", "/movimentacoes/saida", c.operador, { id_lote: lote, quantidade: 1 });
    const historico = (await chamarApi(servidor, "GET", `/movimentacoes?id_lote=${lote}`, c.operador)).corpo as Lista;
    assert.deepEqual(historico.dados.map((m) => `${m.tipo_movimentacao}:${m.status_movimentacao}`), [
      "saida:concluida",
      "inventario:pendente",
      "entrada:concluida",
    ]);
    await c.verificarInvariante(lote);
  });

  it("validação: 400 para entradas inválidas, 404 para lote inexistente, 401 sem token", async () => {
    const lote = await c.novoLote("h", { quantidade: "1" });
    const casos: unknown[] = [
      {},
      { id_lote: lote },
      { quantidade_contada: 1 },
      { id_lote: lote, quantidade_contada: -1 },
      { id_lote: lote, quantidade_contada: "abc" },
      { id_lote: lote, quantidade_contada: 1.2345 },
      { id_lote: lote, quantidade_contada: "9999999999" },
      { id_lote: lote, quantidade_contada: [1] },
      { id_lote: lote, quantidade_contada: { v: 1 } },
      { id_lote: [lote], quantidade_contada: 1 },
      { id_lote: lote, quantidade_contada: 1, observacao: "a\u0000b" },
      { id_lote: lote, quantidade_contada: 1, observacao: ["x"] },
    ];
    for (const corpo of casos) assert.equal((await contar(corpo)).status, 400, JSON.stringify(corpo));
    assert.equal((await contar({ id_lote: 2_000_000_000, quantidade_contada: 1 })).status, 404);
    assert.equal((await chamarApi(servidor, "POST", "/inventario/contagens", undefined, { id_lote: lote, quantidade_contada: 1 })).status, 401);
    assert.equal(await prisma.movimentacao.count({ where: { id_lote: lote, tipo_movimentacao: "inventario" } }), 0);
  });

  it("lista as pendentes por padrão, filtra por lote e status, pagina e obtém por id", async () => {
    const lote = await c.novoLote("i", { quantidade: "4" });
    const criada = (await contar({ id_lote: lote, quantidade_contada: 3 })).corpo as Contagem;
    const lista = (await chamarApi(servidor, "GET", `/inventario/contagens?id_lote=${lote}`, c.operador)).corpo as Lista;
    assert.equal(lista.total, 1);
    assert.equal(lista.dados[0]?.id_movimentacao, criada.id_movimentacao);
    assert.equal(lista.dados[0]?.divergencia, "-1");
    const concluidas = (await chamarApi(servidor, "GET", `/inventario/contagens?id_lote=${lote}&status=concluida`, c.admin)).corpo as Lista;
    assert.equal(concluidas.total, 0);
    const geral = (await chamarApi(servidor, "GET", "/inventario/contagens?limite=2", c.operador)).corpo as Lista;
    assert.ok(geral.dados.every((m) => m.status_movimentacao === "pendente" && m.tipo_movimentacao === "inventario"));
    assert.equal(geral.limite, 2);
    const um = await chamarApi(servidor, "GET", `/inventario/contagens/${criada.id_movimentacao}`, c.operador);
    assert.equal(um.status, 200);
    assert.equal((await chamarApi(servidor, "GET", "/inventario/contagens/999999999999", c.operador)).status, 404);
    const deEntrada = (await c.movimentos(lote)).find((m) => m.tipo_movimentacao === "entrada");
    assert.equal((await chamarApi(servidor, "GET", `/inventario/contagens/${deEntrada?.id_movimentacao}`, c.operador)).status, 404);
    for (const consulta of ["limite=101", "status=x", "status=pendente&status=concluida", "id_lote=0", "pagina=0"]) {
      assert.equal((await chamarApi(servidor, "GET", `/inventario/contagens?${consulta}`, c.operador)).status, 400, consulta);
    }
    assert.equal((await chamarApi(servidor, "GET", "/inventario/contagens/abc", c.operador)).status, 400);
    assert.equal((await chamarApi(servidor, "GET", "/inventario/contagens")).status, 401);
  });
});
