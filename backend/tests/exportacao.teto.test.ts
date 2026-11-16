import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../src/generated/prisma/client.ts";
import { HttpError } from "../src/errors.ts";
import {
  criarExportador,
  TETO_DA_EXPORTACAO,
  type AlertaDeVencimento,
  type DependenciasDaExportacao,
} from "../src/services/alertas.service.ts";

function alerta(i: number): AlertaDeVencimento {
  return {
    id_lote: i,
    numero_lote: `L${i}`,
    data_validade: "2026-12-01",
    dias_restantes: 10,
    quantidade: new Prisma.Decimal(i),
    produto: "Produto",
    unidade_medida: "UN",
    corredor: "C",
    nivel: "1",
    posicao: "A",
  };
}

function simulado(total: number, linhas: number) {
  const chamadas = { buscar: 0, limite: 0 };
  const dependencias: DependenciasDaExportacao = {
    contar: async () => total,
    buscar: async (limite) => {
      chamadas.buscar += 1;
      chamadas.limite = limite;
      return Array.from({ length: Math.min(linhas, limite) }, (_, i) => alerta(i));
    },
  };
  return { chamadas, exportar: criarExportador(dependencias) };
}

async function erroDe(promessa: Promise<unknown>): Promise<HttpError> {
  const erro = await promessa.then(
    () => null,
    (e: unknown) => e,
  );
  assert.ok(erro instanceof HttpError);
  return erro;
}

describe("teto da exportação CSV (G1b), com dependência simulada e sem massa no banco", () => {
  it("o teto é de 10.000 linhas", () => {
    assert.equal(TETO_DA_EXPORTACAO, 10_000);
  });

  it("acima do teto pela contagem: 422 público e nada é carregado nem truncado", async () => {
    const { chamadas, exportar } = simulado(10_001, 10_001);
    const erro = await erroDe(exportar());
    assert.equal(erro.status, 422);
    assert.equal(erro.codigo, "EXPORTACAO_MUITO_GRANDE");
    assert.match(erro.message, /10000 linhas.*Reduza/);
    assert.equal(chamadas.buscar, 0);
  });

  it("exatamente no teto: exporta todas as linhas, cabeçalho mais 10.000", async () => {
    const { chamadas, exportar } = simulado(10_000, 10_000);
    const csv = await exportar();
    assert.equal(chamadas.limite, 10_001);
    assert.equal(csv.split("\r\n").length, 10_000 + 1 + 1);
    assert.ok(csv.startsWith("\uFEFFNúmero do lote;"));
  });

  it("linhas novas entre a contagem e a leitura (leitura devolve 10.001): 422, nunca CSV truncado", async () => {
    const { exportar } = simulado(10_000, 20_000);
    const erro = await erroDe(exportar());
    assert.equal(erro.codigo, "EXPORTACAO_MUITO_GRANDE");
  });

  it("sem alertas: só o cabeçalho", async () => {
    const { exportar } = simulado(0, 0);
    assert.equal(await exportar(), "\uFEFFNúmero do lote;Produto;Validade;Quantidade;Unidade;Localização\r\n");
  });
});
