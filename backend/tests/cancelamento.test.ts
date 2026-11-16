import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario, type Mov } from "./movimentacao.apoio.ts";

type Contagem = Mov & { divergencia: string };
type ErroApi = { erro: { codigo: string } };
type Lista = { dados: Contagem[]; total: number };

describe("cancelamento de contagem pendente (Q3)", () => {
  let servidor: Servidor;
  let c: Cenario;
  let outroAdmin: Cenario;

  const contar = async (lote: number, contado: number): Promise<Contagem> => {
    const r = await chamarApi(servidor, "POST", "/inventario/contagens", c.operador, { id_lote: lote, quantidade_contada: contado });
    assert.equal(r.status, 201, r.texto);
    return r.corpo as Contagem;
  };
  const cancelar = (id: string, token = c.admin) => chamarApi(servidor, "POST", `/inventario/contagens/${id}/cancelar`, token);
  const finalizar = (id: string, token = c.admin) => chamarApi(servidor, "POST", `/inventario/contagens/${id}/finalizar`, token);
  const statusDe = async (id: string): Promise<string> =>
    (await prisma.movimentacao.findUniqueOrThrow({ where: { id_movimentacao: BigInt(id) } })).status_movimentacao;

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "CA");
    outroAdmin = await montarCenario(servidor, "CB");
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await outroAdmin.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("administrador cancela: pendente para cancelada, sem alterar saldo nem criar movimentação, auditado com o autor", async () => {
    const lote = await c.novoLote("a", { quantidade: "10" });
    const contagem = await contar(lote, 7);
    const antes = (await c.movimentos(lote)).length;
    const r = await cancelar(contagem.id_movimentacao);
    assert.equal(r.status, 200);
    const corpo = r.corpo as Contagem;
    assert.equal(corpo.status_movimentacao, "cancelada");
    assert.equal(corpo.divergencia, "-3");
    assert.equal(await c.saldoDo(lote), "10");
    assert.equal((await c.movimentos(lote)).length, antes);
    const linhas = await prisma.$queryRaw<{ operacao: string; id_usuario: number | null; status_novo: string | null }[]>`
      SELECT operacao::text AS operacao, id_usuario, valor_novo->>'status_movimentacao' AS status_novo FROM auditoria_log
      WHERE tabela_afetada = 'movimentacao' AND (valor_novo->>'id_movimentacao')::bigint = ${BigInt(contagem.id_movimentacao)} ORDER BY id_log`;
    assert.deepEqual(linhas.map((l) => `${l.operacao}:${l.status_novo}`), ["INSERT:pendente", "UPDATE:cancelada"]);
    assert.equal(linhas[0]?.id_usuario, c.operadorUsuario.id);
    assert.equal(linhas[1]?.id_usuario, c.adminUsuario.id);
    await c.verificarInvariante(lote);
  });

  it("operador recebe 403 e sem token 401; a contagem segue pendente", async () => {
    const lote = await c.novoLote("b", { quantidade: "4" });
    const contagem = await contar(lote, 3);
    assert.equal((await cancelar(contagem.id_movimentacao, c.operador)).status, 403);
    assert.equal((await chamarApi(servidor, "POST", `/inventario/contagens/${contagem.id_movimentacao}/cancelar`)).status, 401);
    assert.equal(await statusDe(contagem.id_movimentacao), "pendente");
  });

  it("depois do cancelamento o lote aceita nova contagem; as canceladas aparecem no filtro de status", async () => {
    const lote = await c.novoLote("c", { quantidade: "6" });
    const primeira = await contar(lote, 5);
    assert.equal((await chamarApi(servidor, "POST", "/inventario/contagens", c.operador, { id_lote: lote, quantidade_contada: 4 })).status, 409);
    assert.equal((await cancelar(primeira.id_movimentacao)).status, 200);
    const segunda = await contar(lote, 4);
    assert.equal(segunda.status_movimentacao, "pendente");
    const canceladas = (await chamarApi(servidor, "GET", `/inventario/contagens?status=cancelada&id_lote=${lote}`, c.operador)).corpo as Lista;
    assert.equal(canceladas.total, 1);
    assert.equal(canceladas.dados[0]?.id_movimentacao, primeira.id_movimentacao);
  });

  it("já concluída ou já cancelada: 409; outro tipo ou inexistente: 404; id inválido: 400", async () => {
    const lote = await c.novoLote("d", { quantidade: "5" });
    const concluida = await contar(lote, 5);
    assert.equal((await finalizar(concluida.id_movimentacao)).status, 200);
    const recusa = await cancelar(concluida.id_movimentacao);
    assert.equal(recusa.status, 409);
    assert.equal((recusa.corpo as ErroApi).erro.codigo, "CONTAGEM_NAO_PENDENTE");
    assert.equal(await statusDe(concluida.id_movimentacao), "concluida");
    const cancelada = await contar(lote, 4);
    assert.equal((await cancelar(cancelada.id_movimentacao)).status, 200);
    assert.equal((await cancelar(cancelada.id_movimentacao)).status, 409);
    const entrada = (await c.movimentos(lote)).find((m) => m.tipo_movimentacao === "entrada");
    assert.equal((await cancelar(String(entrada?.id_movimentacao))).status, 404);
    assert.equal(String((await prisma.movimentacao.findUniqueOrThrow({ where: { id_movimentacao: entrada?.id_movimentacao ?? 0n } })).status_movimentacao), "concluida");
    assert.equal((await cancelar("999999999999")).status, 404);
    for (const id of ["abc", "0", "-1", "1.5"]) assert.equal((await cancelar(id)).status, 400, id);
  });

  it("dois cancelamentos simultâneos: um vale e o outro recebe 409", async () => {
    const lote = await c.novoLote("e", { quantidade: "5" });
    const contagem = await contar(lote, 2);
    const respostas = await Promise.all([cancelar(contagem.id_movimentacao), cancelar(contagem.id_movimentacao, outroAdmin.admin)]);
    assert.deepEqual(respostas.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await statusDe(contagem.id_movimentacao), "cancelada");
  });

  it("cancelar e finalizar ao mesmo tempo: só um vence e o estado fica coerente (5 repetições)", async () => {
    for (let repeticao = 0; repeticao < 5; repeticao++) {
      const lote = await c.novoLote(`f${repeticao}`, { quantidade: "10" });
      const contagem = await contar(lote, 8);
      const [a, b] = await Promise.all([cancelar(contagem.id_movimentacao), finalizar(contagem.id_movimentacao, outroAdmin.admin)]);
      assert.deepEqual([a.status, b.status].sort(), [200, 409], `repetição ${repeticao}`);
      if (a.status === 200) {
        assert.equal(await statusDe(contagem.id_movimentacao), "cancelada");
        assert.equal(await c.saldoDo(lote), "10");
        assert.equal((await c.movimentos(lote)).filter((m) => m.tipo_movimentacao === "ajuste").length, 0);
      } else {
        assert.equal(await statusDe(contagem.id_movimentacao), "concluida");
        assert.equal(await c.saldoDo(lote), "8");
        assert.equal((await c.movimentos(lote)).filter((m) => m.tipo_movimentacao === "ajuste").length, 1);
      }
      await c.verificarInvariante(lote);
    }
  });
});
