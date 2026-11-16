import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario, type Mov } from "./movimentacao.apoio.ts";

type Contagem = Mov & { divergencia: string };
type Resultado = { contagem: Contagem; ajuste: Mov | null; divergencia: string; saldo_final: string };
type ErroApi = { erro: { codigo: string } };

describe("finalização do inventário (A16, RF15, E1 C3)", () => {
  let servidor: Servidor;
  let c: Cenario;
  const avisos: string[] = [];
  const registrar = (aviso: Error): void => {
    avisos.push(`${aviso.name}: ${aviso.message}`);
  };

  const contar = async (lote: number, contado: string | number): Promise<Contagem> => {
    const r = await chamarApi(servidor, "POST", "/inventario/contagens", c.operador, { id_lote: lote, quantidade_contada: contado });
    assert.equal(r.status, 201, r.texto);
    return r.corpo as Contagem;
  };
  const finalizar = (id: string, token = c.admin) => chamarApi(servidor, "POST", `/inventario/contagens/${id}/finalizar`, token);
  const saida = (lote: number, quantidade: number) =>
    chamarApi(servidor, "POST", "/movimentacoes/saida", c.operador, { id_lote: lote, quantidade });

  before(async () => {
    process.on("warning", registrar);
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "FI");
  });

  after(async () => {
    process.off("warning", registrar);
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("C3 (3 rodadas): contagem 48 com saldo 50, saída de 10 depois, finalização leva o saldo a 38", async () => {
    for (let rodada = 0; rodada < 3; rodada++) {
      const lote = await c.novoLote(`c3-${rodada}`, { quantidade: "50" });
      const contagem = await contar(lote, 48);
      assert.equal((await saida(lote, 10)).status, 201);
      assert.equal(await c.saldoDo(lote), "40");
      const r = await finalizar(contagem.id_movimentacao);
      assert.equal(r.status, 200, r.texto);
      const corpo = r.corpo as Resultado;
      assert.equal(corpo.divergencia, "-2");
      assert.equal(corpo.saldo_final, "38");
      assert.equal(corpo.contagem.status_movimentacao, "concluida");
      assert.equal(corpo.ajuste?.tipo_movimentacao, "ajuste");
      assert.equal(corpo.ajuste?.quantidade, "2");
      assert.equal(corpo.ajuste?.saldo_anterior, "40");
      assert.equal(corpo.ajuste?.saldo_posterior, "38");
      assert.equal(corpo.ajuste?.id_usuario, c.adminUsuario.id);
      assert.equal(await c.saldoDo(lote), "38");
      await c.verificarInvariante(lote);
    }
  });

  it("divergência positiva é somada ao saldo atual", async () => {
    const lote = await c.novoLote("a", { quantidade: "10" });
    const contagem = await contar(lote, "12.5");
    assert.equal((await chamarApi(servidor, "POST", "/movimentacoes/entrada", c.operador, { id_lote: lote, quantidade: 5 })).status, 201);
    const r = await finalizar(contagem.id_movimentacao);
    const corpo = r.corpo as Resultado;
    assert.equal(corpo.divergencia, "2.5");
    assert.equal(corpo.saldo_final, "17.5");
    assert.equal(await c.saldoDo(lote), "17.5");
    await c.verificarInvariante(lote);
  });

  it("divergência zero conclui a contagem sem inserir movimentação de quantidade 0", async () => {
    const lote = await c.novoLote("b", { quantidade: "8" });
    const contagem = await contar(lote, 8);
    const antes = (await c.movimentos(lote)).length;
    const r = await finalizar(contagem.id_movimentacao);
    assert.equal(r.status, 200);
    const corpo = r.corpo as Resultado;
    assert.equal(corpo.ajuste, null);
    assert.equal(corpo.divergencia, "0");
    assert.equal(corpo.contagem.status_movimentacao, "concluida");
    assert.equal((await c.movimentos(lote)).length, antes);
    assert.equal(await c.saldoDo(lote), "8");
    await c.verificarInvariante(lote);
  });

  it("só o administrador finaliza: operador 403, sem token 401, contagem segue pendente", async () => {
    const lote = await c.novoLote("c", { quantidade: "5" });
    const contagem = await contar(lote, 4);
    assert.equal((await finalizar(contagem.id_movimentacao, c.operador)).status, 403);
    assert.equal((await chamarApi(servidor, "POST", `/inventario/contagens/${contagem.id_movimentacao}/finalizar`)).status, 401);
    const atual = await prisma.movimentacao.findUniqueOrThrow({ where: { id_movimentacao: BigInt(contagem.id_movimentacao) } });
    assert.equal(atual.status_movimentacao, "pendente");
    assert.equal(await c.saldoDo(lote), "5");
  });

  it("dupla finalização simultânea: só uma vale (409 na outra) e o ajuste é aplicado uma vez", async () => {
    const lote = await c.novoLote("d", { quantidade: "20" });
    const contagem = await contar(lote, 17);
    const outroAdmin = await montarCenario(servidor, "FJ");
    try {
      const respostas = await Promise.all([finalizar(contagem.id_movimentacao), finalizar(contagem.id_movimentacao, outroAdmin.admin)]);
      assert.deepEqual(respostas.map((r) => r.status).sort(), [200, 409]);
      const recusada = respostas.find((r) => r.status === 409);
      assert.equal((recusada?.corpo as ErroApi).erro.codigo, "CONTAGEM_JA_FINALIZADA");
    } finally {
      await outroAdmin.encerrar();
    }
    assert.equal(await c.saldoDo(lote), "17");
    const ajustes = (await c.movimentos(lote)).filter((m) => m.tipo_movimentacao === "ajuste");
    assert.equal(ajustes.length, 1);
    await c.verificarInvariante(lote);
    assert.equal((await finalizar(contagem.id_movimentacao)).status, 409);
  });

  it("saldo final negativo é recusado com 409 público e a contagem continua pendente", async () => {
    const lote = await c.novoLote("e", { quantidade: "10" });
    const contagem = await contar(lote, 0);
    assert.equal((await saida(lote, 10)).status, 201);
    const r = await finalizar(contagem.id_movimentacao);
    assert.equal(r.status, 409);
    assert.equal((r.corpo as ErroApi).erro.codigo, "SALDO_FINAL_NEGATIVO");
    assert.doesNotMatch(r.texto, /check|violates|lote_/i);
    assert.equal(await c.saldoDo(lote), "0");
    const atual = await prisma.movimentacao.findUniqueOrThrow({ where: { id_movimentacao: BigInt(contagem.id_movimentacao) } });
    assert.equal(atual.status_movimentacao, "pendente");
    await c.verificarInvariante(lote);
  });

  it("estouro do limite NUMERIC na finalização: 422 SALDO_EXCEDE_LIMITE, saldo intacto, contagem pendente e nada gravado", async () => {
    const lote = await c.novoLote("limite", { quantidade: "1" });
    const contagem = await contar(lote, 2);
    const entrada = await chamarApi(servidor, "POST", "/movimentacoes/entrada", c.operador, { id_lote: lote, quantidade: "999999998.999" });
    assert.equal(entrada.status, 201);
    assert.equal(await c.saldoDo(lote), "999999999.999");
    const contarAuditoria = async (): Promise<number> => {
      const [linha] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM auditoria_log WHERE (valor_novo->>'id_lote')::int = ${lote}`;
      return Number(linha?.n ?? 0);
    };
    const movimentosAntes = (await c.movimentos(lote)).length;
    const auditoriaAntes = await contarAuditoria();
    const r = await finalizar(contagem.id_movimentacao);
    assert.equal(r.status, 422);
    assert.equal((r.corpo as ErroApi).erro.codigo, "SALDO_EXCEDE_LIMITE");
    assert.equal(await c.saldoDo(lote), "999999999.999");
    const atual = await prisma.movimentacao.findUniqueOrThrow({ where: { id_movimentacao: BigInt(contagem.id_movimentacao) } });
    assert.equal(atual.status_movimentacao, "pendente");
    assert.equal((await c.movimentos(lote)).length, movimentosAntes);
    assert.equal(await contarAuditoria(), auditoriaAntes);
    await c.verificarInvariante(lote);
  });

  it("depois de finalizada, o lote aceita nova contagem; lote vencido e bloqueado também podem ser finalizados", async () => {
    const lote = await c.novoLote("f", { quantidade: "6" });
    const primeira = await contar(lote, 5);
    assert.equal((await finalizar(primeira.id_movimentacao)).status, 200);
    const segunda = await contar(lote, 5);
    assert.equal(segunda.status_movimentacao, "pendente");
    await prisma.lote.update({ where: { id_lote: lote }, data: { status_lote: "vencido" } });
    assert.equal((await finalizar(segunda.id_movimentacao)).status, 200);
    const bloqueado = await c.novoLote("f2", { quantidade: "6" });
    const contagemBloqueado = await contar(bloqueado, 7);
    await chamarApi(servidor, "POST", `/lotes/${bloqueado}/bloquear`, c.operador, { motivo: "teste" });
    assert.equal((await finalizar(contagemBloqueado.id_movimentacao)).status, 200);
    assert.equal(await c.saldoDo(bloqueado), "7");
  });

  it("404 para contagem inexistente ou movimentação que não é contagem, 400 para id inválido", async () => {
    assert.equal((await finalizar("999999999999")).status, 404);
    const lote = await c.novoLote("g", { quantidade: "1" });
    const entrada = (await c.movimentos(lote))[0];
    assert.equal((await finalizar(String(entrada?.id_movimentacao))).status, 404);
    for (const id of ["abc", "0", "-1", "1.5"]) assert.equal((await finalizar(id)).status, 400, id);
  });

  it("auditoria com o autor correto: UPDATE do status e INSERT do ajuste pelo administrador, contagem pelo operador", async () => {
    const lote = await c.novoLote("h", { quantidade: "9" });
    const contagem = await contar(lote, 7);
    const resultado = (await finalizar(contagem.id_movimentacao)).corpo as Resultado;
    const linhas = await prisma.$queryRaw<{ operacao: string; id_usuario: number | null; status_novo: string | null; id_mov: string | null }[]>`
      SELECT operacao::text AS operacao, id_usuario, valor_novo->>'status_movimentacao' AS status_novo, valor_novo->>'id_movimentacao' AS id_mov
      FROM auditoria_log
      WHERE tabela_afetada = 'movimentacao' AND (valor_novo->>'id_lote')::int = ${lote} ORDER BY id_log`;
    const daContagem = linhas.filter((l) => l.id_mov === contagem.id_movimentacao);
    assert.deepEqual(daContagem.map((l) => `${l.operacao}:${l.status_novo}`), ["INSERT:pendente", "UPDATE:concluida"]);
    assert.equal(daContagem[0]?.id_usuario, c.operadorUsuario.id);
    assert.equal(daContagem[1]?.id_usuario, c.adminUsuario.id);
    const doAjuste = linhas.filter((l) => l.id_mov === resultado.ajuste?.id_movimentacao);
    assert.equal(doAjuste.length, 1);
    assert.equal(doAjuste[0]?.id_usuario, c.adminUsuario.id);
  });

  it("o UPDATE de status_movimentacao é a única alteração permitida em movimentacao (GRANT por coluna)", async () => {
    const lote = await c.novoLote("i", { quantidade: "3" });
    const contagem = await contar(lote, 3);
    const erro = await prisma
      .$executeRaw`UPDATE movimentacao SET quantidade = quantidade WHERE id_movimentacao = ${BigInt(contagem.id_movimentacao)}`
      .then(
        () => null,
        (e: unknown) => e as { meta?: { driverAdapterError?: { cause?: { originalCode?: string } } } },
      );
    assert.equal(erro?.meta?.driverAdapterError?.cause?.originalCode, "42501");
  });

  it("sem aviso de consulta concorrente do pg", async () => {
    await new Promise((ok) => setTimeout(ok, 100));
    assert.deepEqual(avisos.filter((a) => a.includes("client.query")), []);
  });
});
