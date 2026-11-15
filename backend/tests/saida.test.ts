import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { traduzirErroBanco } from "../src/erros-banco.ts";
import { Prisma } from "../src/generated/prisma/client.ts";
import { alterarSaldo } from "../src/services/saldo.service.ts";
import { contextoDe, executarComoUsuario } from "../src/transacao.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, tokenDe, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario, type Mov } from "./movimentacao.apoio.ts";

type ErroApi = { erro: { codigo: string; mensagem: string } };

describe("saída (A12, RF04, RN11, RN16)", () => {
  let servidor: Servidor;
  let c: Cenario;

  const saida = (corpo: unknown, token = c.operador) => chamarApi(servidor, "POST", "/movimentacoes/saida", token, corpo);
  const codigo = (corpo: unknown): string => (corpo as ErroApi).erro.codigo;

  before(async () => {
    servidor = await subir(
      createApp((a) => {
        a.post("/_teste/saida-sem-regra/:id", async (req, res) => {
          const quantidade = new Prisma.Decimal((req.body as { quantidade: string }).quantidade);
          const resultado = await alterarSaldo(contextoDe(req), Number(req.params.id), async (lote) => ({
            tipo: "saida",
            quantidade,
            saldoPosterior: lote.quantidade.minus(quantidade),
            origem: lote.id_localizacao,
            destino: null,
            noLote: { quantidade: lote.quantidade.minus(quantidade) },
          }));
          res.status(201).json(resultado);
        });
      }),
    );
    c = await montarCenario(servidor, "SA");
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("registra a saída: saldos, origem, usuário; saída exata zera o saldo", async () => {
    const lote = await c.novoLote("a", { quantidade: "10" });
    const r = await saida({ id_lote: lote, quantidade: "3.5", motivo: "Venda" });
    assert.equal(r.status, 201);
    const m = r.corpo as Mov;
    assert.equal(m.tipo_movimentacao, "saida");
    assert.equal(m.saldo_anterior, "10");
    assert.equal(m.saldo_posterior, "6.5");
    assert.equal(m.id_localizacao_origem, c.idLocalizacao);
    assert.equal(m.id_localizacao_destino, null);
    assert.equal(m.id_usuario, c.operadorUsuario.id);
    assert.equal((await saida({ id_lote: lote, quantidade: "6.5" }, c.admin)).status, 201);
    assert.equal(await c.saldoDo(lote), "0");
    await c.verificarInvariante(lote);
  });

  it("RN11: quantidade maior que o saldo e lote com saldo 0 recebem 409 sem gravar", async () => {
    const lote = await c.novoLote("b", { quantidade: "5" });
    const r = await saida({ id_lote: lote, quantidade: "5.001" });
    assert.equal(r.status, 409);
    assert.equal(codigo(r.corpo), "SALDO_INSUFICIENTE");
    assert.equal(await c.saldoDo(lote), "5");
    assert.equal((await c.movimentos(lote)).length, 1);
    const vazio = await c.novoLote("b0");
    assert.equal((await saida({ id_lote: vazio, quantidade: "0.001" })).status, 409);
  });

  it("RN16: lote bloqueado, vencido e com validade expirada (status ativo) recebem 422", async () => {
    const bloqueado = await c.novoLote("c1", { quantidade: "5" });
    await chamarApi(servidor, "POST", `/lotes/${bloqueado}/bloquear`, c.operador, { motivo: "teste" });
    const vencido = await c.novoLote("c2", { quantidade: "5" });
    await prisma.lote.update({ where: { id_lote: vencido }, data: { status_lote: "vencido" } });
    const expirado = await c.novoLote("c3", { quantidade: "5", data_validade: "2000-01-01" });
    assert.equal((await prisma.lote.findUniqueOrThrow({ where: { id_lote: expirado } })).status_lote, "ativo");
    for (const lote of [bloqueado, vencido, expirado]) {
      const r = await saida({ id_lote: lote, quantidade: 1 });
      assert.equal(r.status, 422, String(lote));
      assert.equal(codigo(r.corpo), "LOTE_INDISPONIVEL");
      assert.equal(await c.saldoDo(lote), "5");
      assert.equal((await c.movimentos(lote)).length, 1);
    }
  });

  it("o estado é validado antes do saldo: lote bloqueado com quantidade maior que o saldo é 422, não 409", async () => {
    const lote = await c.novoLote("d", { quantidade: "1" });
    await chamarApi(servidor, "POST", `/lotes/${lote}/bloquear`, c.operador, { motivo: "teste" });
    assert.equal((await saida({ id_lote: lote, quantidade: 100 })).status, 422);
  });

  it("a trigger do banco é a última barreira: se a aplicação deixar passar, a resposta é 422 pública, nunca 500", async () => {
    const lote = await c.novoLote("e", { quantidade: "5" });
    await chamarApi(servidor, "POST", `/lotes/${lote}/bloquear`, c.operador, { motivo: "teste" });
    const r = await chamarApi(servidor, "POST", `/_teste/saida-sem-regra/${lote}`, c.operador, { quantidade: "1" });
    assert.equal(r.status, 422);
    assert.equal(codigo(r.corpo), "OPERACAO_RECUSADA");
    assert.doesNotMatch(r.texto, /Saída não permitida|P0001|trigger/i);
    assert.equal(await c.saldoDo(lote), "5");
    assert.equal((await c.movimentos(lote)).length, 1);
    const direto = await executarComoUsuario({ idUsuario: c.operadorUsuario.id, ip: "" }, (tx) =>
      tx.movimentacao.create({
        data: {
          tipo_movimentacao: "saida",
          quantidade: "1",
          saldo_anterior: "5",
          saldo_posterior: "4",
          id_lote: lote,
          id_usuario: c.operadorUsuario.id,
        },
      }),
    ).then(
      () => null,
      (e: unknown) => e,
    );
    assert.equal(traduzirErroBanco(direto)?.status, 422);
  });

  it("validação, lote inexistente, token e usuário vindo do corpo", async () => {
    const lote = await c.novoLote("f", { quantidade: "5" });
    for (const corpo of [{}, { id_lote: lote }, { id_lote: lote, quantidade: 0 }, { id_lote: lote, quantidade: -2 }, { id_lote: lote, quantidade: "x" }, { id_lote: [lote], quantidade: 1 }, { id_lote: lote, quantidade: 1, motivo: "\u0000" }]) {
      assert.equal((await saida(corpo)).status, 400, JSON.stringify(corpo));
    }
    assert.equal((await saida({ id_lote: 2_000_000_000, quantidade: 1 })).status, 404);
    assert.equal((await chamarApi(servidor, "POST", "/movimentacoes/saida", undefined, { id_lote: lote, quantidade: 1 })).status, 401);
    const m = (await saida({ id_lote: lote, quantidade: 1, id_usuario: 1 })).corpo as Mov;
    assert.equal(m.id_usuario, c.operadorUsuario.id);
  });

  it("C1: dez saídas simultâneas de 10 em lote com saldo 50 (3 rodadas): 5 aceitas, 5 recusadas com 409, saldo final 0", async () => {
    for (let rodada = 0; rodada < 3; rodada++) {
      const lote = await c.novoLote(`c1-${rodada}`, { quantidade: "50" });
      const respostas = await Promise.all(
        Array.from({ length: 10 }, (_, i) => saida({ id_lote: lote, quantidade: 10 }, i % 2 === 0 ? c.operador : c.admin)),
      );
      const status = respostas.map((r) => r.status);
      assert.equal(status.filter((s) => s === 201).length, 5, `rodada ${rodada}: ${status.join(",")}`);
      assert.equal(status.filter((s) => s === 409).length, 5, `rodada ${rodada}: ${status.join(",")}`);
      assert.equal(status.filter((s) => s >= 500).length, 0);
      for (const r of respostas.filter((x) => x.status === 409)) assert.equal(codigo(r.corpo), "SALDO_INSUFICIENTE");
      assert.equal(await c.saldoDo(lote), "0");
      const lista = await c.movimentos(lote);
      assert.equal(lista.filter((m) => m.tipo_movimentacao === "saida").length, 5);
      await c.verificarInvariante(lote);
      const auditoria = await prisma.$queryRaw<{ id_usuario: number | null; id_movimentacao: string }[]>`
        SELECT id_usuario, valor_novo->>'id_movimentacao' AS id_movimentacao FROM auditoria_log
        WHERE tabela_afetada = 'movimentacao' AND (valor_novo->>'id_lote')::int = ${lote}`;
      assert.equal(auditoria.length, 6);
      for (const m of lista) {
        const linha = auditoria.find((a) => a.id_movimentacao === m.id_movimentacao.toString());
        assert.equal(linha?.id_usuario, m.id_usuario, `auditoria da movimentação ${m.id_movimentacao}`);
      }
    }
  });
});
