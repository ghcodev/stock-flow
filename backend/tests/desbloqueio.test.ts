import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";

type LoteResposta = { status_lote: string; motivo_bloqueio: string | null; data_bloqueio: string | null };

describe("bloqueio e desbloqueio decidem vencido pela data do banco, sob a trava do lote (G2)", () => {
  let servidor: Servidor;
  let c: Cenario;

  const validade = async (id: number, deslocamento: number | null): Promise<void> => {
    if (deslocamento === null) await prisma.$executeRaw`UPDATE lote SET data_validade = NULL WHERE id_lote = ${id}`;
    else await prisma.$executeRaw`UPDATE lote SET data_validade = hoje_operacional() + ${deslocamento}::int WHERE id_lote = ${id}`;
  };
  const bloquear = (id: number) => chamarApi(servidor, "POST", `/lotes/${id}/bloquear`, c.operador, { motivo: "teste de fuso" });
  const desbloquear = (id: number) => chamarApi(servidor, "POST", `/lotes/${id}/desbloquear`, c.admin);

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "DB");
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("validade anterior ao hoje operacional do banco volta como vencido; hoje, futura e sem validade voltam como ativo", async () => {
    const casos: [string, number | null, string][] = [
      ["ontem", -1, "vencido"],
      ["antigo", -400, "vencido"],
      ["hoje", 0, "ativo"],
      ["amanha", 1, "ativo"],
      ["distante", 400, "ativo"],
      ["semvalidade", null, "ativo"],
    ];
    for (const [sufixo, deslocamento, esperado] of casos) {
      const id = await c.novoLote(sufixo, { quantidade: "2" });
      await validade(id, deslocamento);
      const bloqueado = await bloquear(id);
      assert.equal(bloqueado.status, 200, `${sufixo} ${bloqueado.texto}`);
      assert.equal((bloqueado.corpo as LoteResposta).status_lote, "bloqueado");
      assert.ok((bloqueado.corpo as LoteResposta).data_bloqueio);
      const livre = await desbloquear(id);
      assert.equal(livre.status, 200, `${sufixo} ${livre.texto}`);
      const corpo = livre.corpo as LoteResposta;
      assert.equal(corpo.status_lote, esperado, sufixo);
      assert.equal(corpo.motivo_bloqueio, null);
      assert.equal(corpo.data_bloqueio, null);
    }
  });

  it("a data do bloqueio é o relógio do banco: fica entre dois instantes lidos do banco ao redor da chamada", async () => {
    const lote = await c.novoLote("relogio", { quantidade: "1" });
    const relogio = async (): Promise<number> => {
      const [linha] = await prisma.$queryRaw<{ agora: Date }[]>`SELECT clock_timestamp() AS agora`;
      return new Date(linha?.agora ?? 0).getTime();
    };
    const antes = await relogio();
    const r = await bloquear(lote);
    const depois = await relogio();
    const gravado = new Date((r.corpo as LoteResposta).data_bloqueio ?? 0).getTime();
    assert.ok(gravado >= antes - 1 && gravado <= depois + 1, `${gravado} fora de [${antes}, ${depois}]`);
  });

  it("estados inválidos e lote inexistente: 409 e 404", async () => {
    const lote = await c.novoLote("estados", { quantidade: "1" });
    assert.equal((await desbloquear(lote)).status, 409);
    assert.equal((await bloquear(lote)).status, 200);
    assert.equal((await bloquear(lote)).status, 409);
    assert.equal((await desbloquear(lote)).status, 200);
    assert.equal((await desbloquear(lote)).status, 409);
    assert.equal((await bloquear(2_000_000_000)).status, 404);
    assert.equal((await desbloquear(2_000_000_000)).status, 404);
  });

  it("bloquear e desbloquear simultâneos do mesmo lote terminam num estado coerente", async () => {
    const lote = await c.novoLote("corrida", { quantidade: "1" });
    assert.equal((await bloquear(lote)).status, 200);
    const respostas = await Promise.all([desbloquear(lote), desbloquear(lote), bloquear(lote)]);
    const status = respostas.map((r) => r.status);
    assert.ok(status.every((s) => s === 200 || s === 409), status.join(","));
    const final = (await prisma.lote.findUniqueOrThrow({ where: { id_lote: lote } })).status_lote;
    assert.ok(final === "ativo" || final === "bloqueado");
  });
});
