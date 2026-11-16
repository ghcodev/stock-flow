import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../src/generated/prisma/client.ts";
import { criarAlteradorDeSaldo, type DependenciasSaldo, type LoteTravado } from "../src/services/saldo.service.ts";
import type { Tx } from "../src/transacao.ts";

const D = (valor: string | number): Prisma.Decimal => new Prisma.Decimal(valor);
const INSTANTE_SIMULADO = new Date("2026-11-15T12:34:56.789Z");

const LOTE: LoteTravado = {
  id_lote: 7,
  id_produto: 1,
  id_localizacao: 3,
  status_lote: "ativo",
  quantidade: D(10),
  validade_expirada: false,
};

function montar() {
  const chamadas: string[] = [];
  const gravacoes: { data_movimentacao?: Date }[] = [];
  const tx = {
    lote: {
      update: async () => {
        chamadas.push("lote.update");
        return { id_lote: 7 };
      },
    },
    movimentacao: {
      create: async (args: { data: { data_movimentacao?: Date } }) => {
        chamadas.push("movimentacao.create");
        gravacoes.push(args.data);
        return { id_movimentacao: 1n };
      },
    },
  } as unknown as Tx;
  const dependencias: DependenciasSaldo = {
    executar: async (_contexto, operacao) => {
      chamadas.push("executar");
      return operacao(tx);
    },
    travar: async () => {
      chamadas.push("travar");
      return LOTE;
    },
    instante: async () => {
      chamadas.push("instante");
      return INSTANTE_SIMULADO;
    },
  };
  return { chamadas, gravacoes, alterar: criarAlteradorDeSaldo(dependencias) };
}

describe("ordem das chamadas de alterarSaldo (M2), sem banco", () => {
  it("o instante do banco é lido depois da trava e da decisão, e antes do UPDATE do lote e do INSERT da movimentação", async () => {
    const { chamadas, gravacoes, alterar } = montar();
    await alterar({ idUsuario: 1, ip: "" }, 7, async (lote) => {
      chamadas.push("decidir");
      return {
        tipo: "entrada",
        quantidade: D(1),
        saldoPosterior: lote.quantidade.plus(1),
        origem: null,
        destino: lote.id_localizacao,
        noLote: { quantidade: lote.quantidade.plus(1) },
      };
    });
    assert.deepEqual(chamadas, ["executar", "travar", "decidir", "instante", "lote.update", "movimentacao.create"]);
    assert.equal(gravacoes[0]?.data_movimentacao?.getTime(), INSTANTE_SIMULADO.getTime());
  });

  it("se a decisão recusar, o relógio não é lido e nada é gravado", async () => {
    const { chamadas, alterar } = montar();
    await assert.rejects(
      alterar({ idUsuario: 1, ip: "" }, 7, async () => {
        chamadas.push("decidir");
        throw new Error("recusado");
      }),
    );
    assert.deepEqual(chamadas, ["executar", "travar", "decidir"]);
  });
});
