import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario, type Mov } from "./movimentacao.apoio.ts";

type ErroApi = { erro: { codigo: string } };

describe("ajuste de estoque (A17, RF16, RN15, RN17, E1 C4)", () => {
  let servidor: Servidor;
  let c: Cenario;
  let segundoAdmin: Cenario;

  const ajustar = (corpo: unknown, token = c.admin) => chamarApi(servidor, "POST", "/movimentacoes/ajuste", token, corpo);
  const justificativa = "Correção após conferência física";
  const codigo = (corpo: unknown): string => (corpo as ErroApi).erro.codigo;

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "AJ");
    segundoAdmin = await montarCenario(servidor, "AK");
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await segundoAdmin.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("administrador ajusta: saldos anterior e posterior, quantidade = diferença, motivo gravado, lote atualizado", async () => {
    const lote = await c.novoLote("a", { quantidade: "50" });
    const r = await ajustar({ id_lote: lote, saldo_exibido: "50", novo_saldo: "45.5", motivo: `  ${justificativa}  ` });
    assert.equal(r.status, 201);
    const m = r.corpo as Mov;
    assert.equal(m.tipo_movimentacao, "ajuste");
    assert.equal(m.saldo_anterior, "50");
    assert.equal(m.saldo_posterior, "45.5");
    assert.equal(m.quantidade, "4.5");
    assert.equal(m.motivo_movimentacao, justificativa);
    assert.equal(m.id_usuario, c.adminUsuario.id);
    assert.equal(await c.saldoDo(lote), "45.5");
    const aumento = await ajustar({ id_lote: lote, saldo_exibido: 45.5, novo_saldo: 60, motivo: justificativa });
    assert.equal((aumento.corpo as Mov).quantidade, "14.5");
    assert.equal(await c.saldoDo(lote), "60");
    await c.verificarInvariante(lote);
  });

  it("RN15: operador recebe 403 e sem token 401; nada é gravado", async () => {
    const lote = await c.novoLote("b", { quantidade: "5" });
    const corpo = { id_lote: lote, saldo_exibido: 5, novo_saldo: 4, motivo: justificativa };
    assert.equal((await ajustar(corpo, c.operador)).status, 403);
    assert.equal((await chamarApi(servidor, "POST", "/movimentacoes/ajuste", undefined, corpo)).status, 401);
    assert.equal(await c.saldoDo(lote), "5");
    assert.equal((await c.movimentos(lote)).length, 1);
  });

  it("RN17: justificativa com 10 caracteres ou mais depois de aparar os espaços", async () => {
    const lote = await c.novoLote("c", { quantidade: "5" });
    const base = { id_lote: lote, saldo_exibido: 5, novo_saldo: 4 };
    for (const motivo of ["curto", "  curto    ", "123456789", "         123456789         ", "", "          "]) {
      assert.equal((await ajustar({ ...base, motivo })).status, 400, JSON.stringify(motivo));
    }
    assert.equal(await c.saldoDo(lote), "5");
    assert.equal((await ajustar({ ...base, motivo: "  1234567890  " })).status, 201);
    assert.equal(await c.saldoDo(lote), "4");
  });

  it("saldo exibido diferente do atual é 409 e nada muda; comparação exata em Decimal", async () => {
    const lote = await c.novoLote("d", { quantidade: "0.3" });
    const desatualizado = await ajustar({ id_lote: lote, saldo_exibido: "0.2", novo_saldo: 1, motivo: justificativa });
    assert.equal(desatualizado.status, 409);
    assert.equal(codigo(desatualizado.corpo), "SALDO_DESATUALIZADO");
    assert.equal(await c.saldoDo(lote), "0.3");
    assert.equal((await ajustar({ id_lote: lote, saldo_exibido: "0.300", novo_saldo: "0.1", motivo: justificativa })).status, 201);
    assert.equal(await c.saldoDo(lote), "0.1");
    await c.verificarInvariante(lote);
  });

  it("ajuste que não muda o saldo é recusado (o CHECK exige quantidade > 0 fora de inventário)", async () => {
    const lote = await c.novoLote("e", { quantidade: "5" });
    const r = await ajustar({ id_lote: lote, saldo_exibido: 5, novo_saldo: "5.000", motivo: justificativa });
    assert.equal(r.status, 422);
    assert.equal(codigo(r.corpo), "AJUSTE_SEM_ALTERACAO");
    assert.equal((await c.movimentos(lote)).length, 1);
  });

  it("RN16: o descarte de lote vencido, com validade expirada ou bloqueado é feito por ajuste (novo saldo 0)", async () => {
    const vencido = await c.novoLote("f1", { quantidade: "7" });
    await prisma.lote.update({ where: { id_lote: vencido }, data: { status_lote: "vencido" } });
    const expirado = await c.novoLote("f2", { quantidade: "7", data_validade: "2000-01-01" });
    const bloqueado = await c.novoLote("f3", { quantidade: "7" });
    await chamarApi(servidor, "POST", `/lotes/${bloqueado}/bloquear`, c.operador, { motivo: "teste" });
    for (const lote of [vencido, expirado, bloqueado]) {
      const r = await ajustar({ id_lote: lote, saldo_exibido: 7, novo_saldo: 0, motivo: "Descarte de lote impróprio" });
      assert.equal(r.status, 201, String(lote));
      assert.equal((r.corpo as Mov).saldo_posterior, "0");
      assert.equal((r.corpo as Mov).quantidade, "7");
      assert.equal(await c.saldoDo(lote), "0");
      await c.verificarInvariante(lote);
    }
  });

  it("validação: 400 para entradas inválidas, 404 para lote inexistente", async () => {
    const lote = await c.novoLote("g", { quantidade: "5" });
    const base = { id_lote: lote, saldo_exibido: 5, novo_saldo: 4, motivo: justificativa };
    const casos: unknown[] = [
      {},
      { ...base, id_lote: undefined },
      { ...base, saldo_exibido: undefined },
      { ...base, novo_saldo: undefined },
      { ...base, motivo: undefined },
      { ...base, novo_saldo: -1 },
      { ...base, novo_saldo: "abc" },
      { ...base, novo_saldo: 1.2345 },
      { ...base, novo_saldo: "9999999999" },
      { ...base, novo_saldo: [1] },
      { ...base, saldo_exibido: { v: 5 } },
      { ...base, id_lote: [lote] },
      { ...base, motivo: ["longa o bastante para passar"] },
      { ...base, motivo: "justificativa\u0000com nul" },
      { ...base, motivo: "m".repeat(256) },
    ];
    for (const corpo of casos) assert.equal((await ajustar(corpo)).status, 400, JSON.stringify(corpo));
    assert.equal((await ajustar({ ...base, id_lote: 2_000_000_000 })).status, 404);
    assert.equal(await c.saldoDo(lote), "5");
  });

  it("auditoria: UPDATE do lote e INSERT do ajuste com o id_usuario do administrador, lote antes da movimentação", async () => {
    const lote = await c.novoLote("h", { quantidade: "10" });
    const m = (await ajustar({ id_lote: lote, saldo_exibido: 10, novo_saldo: 8, motivo: justificativa })).corpo as Mov;
    const linhas = await prisma.$queryRaw<{ tabela_afetada: string; id_usuario: number | null; motivo: string | null }[]>`
      SELECT tabela_afetada, id_usuario, valor_novo->>'motivo_movimentacao' AS motivo FROM auditoria_log
      WHERE (tabela_afetada = 'lote' AND operacao = 'UPDATE' AND (valor_novo->>'id_lote')::int = ${lote})
         OR (tabela_afetada = 'movimentacao' AND (valor_novo->>'id_movimentacao')::bigint = ${BigInt(m.id_movimentacao)})
      ORDER BY id_log`;
    assert.deepEqual(linhas.map((l) => l.tabela_afetada), ["lote", "movimentacao"]);
    assert.ok(linhas.every((l) => l.id_usuario === c.adminUsuario.id));
    assert.equal(linhas[1]?.motivo, justificativa);
  });

  it("C4 (10 repetições): ajuste com a tela mostrando 50 enquanto uma saída de 10 é gravada: 10 de 10 coerentes", async () => {
    for (let repeticao = 0; repeticao < 10; repeticao++) {
      const lote = await c.novoLote(`c4-${repeticao}`, { quantidade: "50" });
      const [a, s] = await Promise.all([
        ajustar({ id_lote: lote, saldo_exibido: 50, novo_saldo: 45, motivo: justificativa }),
        chamarApi(servidor, "POST", "/movimentacoes/saida", c.operador, { id_lote: lote, quantidade: 10 }),
      ]);
      assert.equal(s.status, 201, `repetição ${repeticao}: saída ${s.status}`);
      assert.ok(a.status === 201 || a.status === 409, `repetição ${repeticao}: ajuste ${a.status}`);
      const final = await c.saldoDo(lote);
      if (a.status === 201) {
        assert.equal(final, "35", `repetição ${repeticao}: ajuste antes da saída`);
      } else {
        assert.equal(codigo(a.corpo), "SALDO_DESATUALIZADO");
        assert.equal(final, "40", `repetição ${repeticao}: saída antes do ajuste`);
      }
      const saidas = (await c.movimentos(lote)).filter((m) => m.tipo_movimentacao === "saida");
      assert.equal(saidas.length, 1, "a saída não pode ser apagada");
      await c.verificarInvariante(lote);
    }
  });

  it("dois ajustes simultâneos com o mesmo saldo exibido: um vale e o outro recebe 409", async () => {
    const lote = await c.novoLote("i", { quantidade: "50" });
    const [um, dois] = await Promise.all([
      ajustar({ id_lote: lote, saldo_exibido: 50, novo_saldo: 40, motivo: justificativa }),
      ajustar({ id_lote: lote, saldo_exibido: 50, novo_saldo: 30, motivo: justificativa }, segundoAdmin.admin),
    ]);
    assert.deepEqual([um.status, dois.status].sort(), [201, 409]);
    assert.equal((await c.movimentos(lote)).filter((m) => m.tipo_movimentacao === "ajuste").length, 1);
    await c.verificarInvariante(lote);
  });
});
