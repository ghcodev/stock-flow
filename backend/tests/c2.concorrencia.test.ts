import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";

type Auditoria = {
  tabela_afetada: string;
  id_usuario: number | null;
  status_novo: string | null;
  status_anterior: string | null;
  qtd_novo: string | null;
  qtd_anterior: string | null;
};

describe("E1 C2: bloqueio e desbloqueio pelo administrador durante entradas do operador (20 operações)", () => {
  let servidor: Servidor;
  let c: Cenario;

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "C2");
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("20 de 20 operações auditadas com o autor correto e o saldo exato", async () => {
    for (let rodada = 0; rodada < 3; rodada++) {
      const lote = await c.novoLote(`r${rodada}`, { quantidade: "100" });
      const entradas = Array.from({ length: 10 }, () =>
        chamarApi(servidor, "POST", "/movimentacoes/entrada", c.operador, { id_lote: lote, quantidade: 1 }),
      );
      const bloqueios = (async () => {
        const status: number[] = [];
        for (let i = 0; i < 5; i++) {
          status.push((await chamarApi(servidor, "POST", `/lotes/${lote}/bloquear`, c.admin, { motivo: `rodada ${i}` })).status);
          status.push((await chamarApi(servidor, "POST", `/lotes/${lote}/desbloquear`, c.admin)).status);
        }
        return status;
      })();
      const [respostasEntradas, statusAdmin] = await Promise.all([Promise.all(entradas), bloqueios]);
      assert.ok(respostasEntradas.every((r) => r.status === 201), `rodada ${rodada}`);
      assert.ok(statusAdmin.every((s) => s === 200), `rodada ${rodada}: ${statusAdmin.join(",")}`);
      assert.equal(await c.saldoDo(lote), "110");
      await c.verificarInvariante(lote);

      const linhas = await prisma.$queryRaw<Auditoria[]>`
        SELECT tabela_afetada, id_usuario,
               valor_novo->>'status_lote' AS status_novo, valor_anterior->>'status_lote' AS status_anterior,
               valor_novo->>'quantidade' AS qtd_novo, valor_anterior->>'quantidade' AS qtd_anterior
        FROM auditoria_log
        WHERE (tabela_afetada = 'lote' AND operacao = 'UPDATE' AND (valor_novo->>'id_lote')::int = ${lote})
           OR (tabela_afetada = 'movimentacao' AND (valor_novo->>'id_lote')::int = ${lote})`;
      const alteracoesDeStatus = linhas.filter((l) => l.tabela_afetada === "lote" && l.status_novo !== l.status_anterior);
      const alteracoesDeSaldo = linhas.filter(
        (l) => l.tabela_afetada === "lote" && l.status_novo === l.status_anterior && l.qtd_novo !== l.qtd_anterior,
      );
      const movimentacoes = linhas.filter((l) => l.tabela_afetada === "movimentacao");
      assert.equal(alteracoesDeStatus.length, 10);
      assert.equal(alteracoesDeSaldo.length, 10);
      assert.equal(movimentacoes.length, 11);
      assert.ok(alteracoesDeStatus.every((l) => l.id_usuario === c.adminUsuario.id));
      assert.ok(alteracoesDeSaldo.every((l) => l.id_usuario === c.operadorUsuario.id));
      assert.ok(movimentacoes.every((l) => l.id_usuario === c.operadorUsuario.id));
    }
  });
});
