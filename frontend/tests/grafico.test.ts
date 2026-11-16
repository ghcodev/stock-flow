import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adicionarDias, marcasDoEixo, maximoDaEscala, montarDias, resumirDias } from "../src/util/grafico.ts";
import type { PontoDoGrafico } from "../src/api/tipos.ts";

describe("dados do gráfico de movimentações por dia e tipo (F6)", () => {
  it("soma de dias cruza mês e ano em UTC", () => {
    assert.equal(adicionarDias("2026-03-01", -1), "2026-02-28");
    assert.equal(adicionarDias("2026-01-01", -1), "2025-12-31");
    assert.equal(adicionarDias("2026-11-16", -29), "2026-10-18");
    assert.equal(adicionarDias("2026-11-16", 0), "2026-11-16");
  });

  it("monta 30 dias terminando no fim, preenchendo zeros e somando por tipo", () => {
    const pontos: PontoDoGrafico[] = [
      { dia: "2026-11-16", tipo: "entrada", total: 3 },
      { dia: "2026-11-16", tipo: "saida", total: 2 },
      { dia: "2026-11-10", tipo: "entrada", total: 5 },
    ];
    const dias = montarDias(pontos, "2026-11-16");
    assert.equal(dias.length, 30);
    assert.equal(dias[0]?.dia, "2026-10-18");
    assert.equal(dias[29]?.dia, "2026-11-16");
    assert.deepEqual(dias[29]?.valores, { entrada: 3, saida: 2, transferencia: 0, ajuste: 0, inventario: 0 });
    assert.equal(dias[29]?.total, 5);
    assert.equal(dias.find((d) => d.dia === "2026-11-10")?.total, 5);
    assert.equal(dias.find((d) => d.dia === "2026-11-11")?.total, 0);
  });

  it("a janela vem só do dia de referência do banco: dia futuro e fora da janela são ignorados, tipo e total inválidos também", () => {
    const pontos = [
      { dia: "2026-11-17", tipo: "ajuste", total: 4 },
      { dia: "2026-11-16", tipo: "xpto", total: 9 },
      { dia: "2026-01-01", tipo: "entrada", total: 7 },
      { dia: "2026-11-16", tipo: "entrada", total: -1 },
      { dia: "2026-11-16", tipo: "saida", total: 1.5 },
      { dia: "2026-11-16", tipo: "saida", total: 2 },
    ] as unknown as PontoDoGrafico[];
    const dias = montarDias(pontos, "2026-11-16");
    assert.equal(dias[29]?.dia, "2026-11-16");
    assert.equal(dias[29]?.total, 2);
    assert.equal(resumirDias(dias).total, 2);
  });

  it("o resultado não depende do relógio ou do fuso do navegador (adiantado ou atrasado)", () => {
    const pontos: PontoDoGrafico[] = [{ dia: "2026-11-16", tipo: "entrada", total: 3 }];
    const original = Date;
    try {
      for (const deslocamentoMs of [-36 * 3600_000, 0, 36 * 3600_000]) {
        const base = original.now() + deslocamentoMs;
        globalThis.Date = class extends original {
          constructor(...args: unknown[]) {
            if (args.length === 0) super(base);
            else super(...(args as [number]));
          }
          static override now(): number {
            return base;
          }
        } as DateConstructor;
        const dias = montarDias(pontos, "2026-11-16");
        assert.equal(dias[0]?.dia, "2026-10-18");
        assert.equal(dias[29]?.dia, "2026-11-16");
        assert.equal(dias[29]?.total, 3);
      }
    } finally {
      globalThis.Date = original;
    }
  });

  it("período vazio e último movimento antigo: 30 dias zerados terminando na referência", () => {
    for (const pontos of [[], [{ dia: "2026-06-01", tipo: "entrada", total: 5 }]] as PontoDoGrafico[][]) {
      const dias = montarDias(pontos, "2026-11-16");
      assert.equal(dias.length, 30);
      assert.equal(dias[29]?.dia, "2026-11-16");
      assert.equal(resumirDias(dias).total, 0);
    }
  });

  it("escala em números redondos e marcas inteiras do eixo", () => {
    assert.equal(maximoDaEscala(0), 5);
    assert.equal(maximoDaEscala(5), 5);
    assert.equal(maximoDaEscala(6), 10);
    assert.equal(maximoDaEscala(11), 20);
    assert.equal(maximoDaEscala(37), 50);
    assert.equal(maximoDaEscala(51), 100);
    assert.equal(maximoDaEscala(3842), 5000);
    for (const maximo of [5, 10, 20, 50, 100, 5000]) {
      const marcas = marcasDoEixo(maximo);
      assert.equal(marcas[0], 0);
      assert.equal(marcas[marcas.length - 1], maximo);
      assert.ok(marcas.every((m) => Number.isInteger(m)));
    }
  });

  it("resumo: total, maior dia e dia de pico; sem movimento não há pico", () => {
    const dias = montarDias([{ dia: "2026-11-15", tipo: "entrada", total: 8 }, { dia: "2026-11-16", tipo: "saida", total: 3 }], "2026-11-16");
    assert.deepEqual(resumirDias(dias), { total: 11, maximoDiario: 8, diaDePico: "2026-11-15" });
    assert.deepEqual(resumirDias(montarDias([], "2026-11-16")), { total: 0, maximoDiario: 0, diaDePico: null });
  });
});
