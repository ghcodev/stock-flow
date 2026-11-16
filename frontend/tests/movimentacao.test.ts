import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { somarDecimais, subtrairDecimais } from "../src/util/decimal.ts";
import {
  avaliarQuantidade,
  avisoDaEntrada,
  bloqueioDaSaida,
  bloqueioDaTransferencia,
  interpretarFalhaDeMovimentacao,
  validarDestino,
  validarJustificativa,
} from "../src/util/movimentacao.ts";
import { criarEnvioUnico, criarFiltroDeLeituraDupla } from "../src/util/envio.ts";
import { corpoDeSaldo, corpoDeTransferencia } from "../src/api/movimentacoes.ts";
import { ErroDaApi, ErroDeRede } from "../src/api/erros.ts";

const lote = (extras: Record<string, unknown> = {}) => ({
  status_lote: "ativo" as const,
  data_validade: "2026-12-31",
  quantidade: "10.500",
  id_localizacao: 5,
  produto: { id_produto: 1, nome: "Leite", unidade_medida: "L" },
  ...extras,
});

describe("soma e subtração de decimais em texto", () => {
  it("é exata, sem ponto flutuante", () => {
    assert.equal(somarDecimais("0.1", "0.2"), "0.3");
    assert.equal(somarDecimais("10.500", "2.250"), "12.75");
    assert.equal(somarDecimais("999999999.998", "0.001"), "999999999.999");
    assert.equal(subtrairDecimais("10.500", "10.5"), "0");
    assert.equal(subtrairDecimais("1", "2.5"), "-1.5");
    assert.equal(subtrairDecimais("0.3", "0.1"), "0.2");
    assert.equal(somarDecimais("abc", "1"), null);
    assert.equal(somarDecimais("9007199254740993", "1"), "9007199254740994");
  });
});

describe("avaliação da quantidade em tempo real", () => {
  it("vazio não é erro e mostra nada", () => {
    assert.deepEqual(avaliarQuantidade("  ", lote(), "saida"), { erro: null, saldoApos: null });
  });

  it("recusa formato inválido e zero", () => {
    for (const ruim of ["abc", "-1", "1.5555", "1e3", "1,5,5", "1000000000"]) assert.notEqual(avaliarQuantidade(ruim, lote(), "entrada").erro, null, ruim);
    assert.equal(avaliarQuantidade("0", lote(), "saida").erro, "A quantidade deve ser maior que zero.");
    assert.equal(avaliarQuantidade("0,000", lote(), "entrada").erro, "A quantidade deve ser maior que zero.");
  });

  it("saída: até o saldo é aceita (inclusive o saldo todo), acima é saldo insuficiente com o disponível", () => {
    assert.deepEqual(avaliarQuantidade("10,5", lote(), "saida"), { erro: null, saldoApos: "0" });
    assert.deepEqual(avaliarQuantidade("3", lote(), "saida"), { erro: null, saldoApos: "7.5" });
    assert.equal(avaliarQuantidade("10,501", lote(), "saida").erro, "Saldo insuficiente: disponível 10,5 L.");
  });

  it("entrada: calcula o saldo depois e respeita o limite NUMERIC(12,3)", () => {
    assert.deepEqual(avaliarQuantidade("2,25", lote(), "entrada"), { erro: null, saldoApos: "12.75" });
    assert.equal(avaliarQuantidade("1", lote({ quantidade: "999999999.999" }), "entrada").erro, "O saldo do lote excederia o limite permitido.");
    assert.equal(avaliarQuantidade("0,001", lote({ quantidade: "999999999.998" }), "entrada").erro, null);
  });
});

describe("regras de bloqueio por status e validade", () => {
  it("saída bloqueada para bloqueado, vencido e validade expirada", () => {
    assert.equal(bloqueioDaSaida(lote(), "2026-11-16"), null);
    assert.match(bloqueioDaSaida(lote({ status_lote: "bloqueado" }), "2026-11-16") ?? "", /bloqueado/);
    assert.match(bloqueioDaSaida(lote({ status_lote: "vencido" }), "2026-11-16") ?? "", /vencido/);
    assert.match(bloqueioDaSaida(lote({ data_validade: "2026-11-15" }), "2026-11-16") ?? "", /expirada/);
    assert.equal(bloqueioDaSaida(lote({ data_validade: "2026-11-16" }), "2026-11-16"), null);
    assert.equal(bloqueioDaSaida(lote({ data_validade: null }), "2026-11-16"), null);
  });

  it("transferência só de lote ativo e com saldo", () => {
    assert.equal(bloqueioDaTransferencia(lote()), null);
    assert.match(bloqueioDaTransferencia(lote({ status_lote: "bloqueado" })) ?? "", /ativo/);
    assert.match(bloqueioDaTransferencia(lote({ quantidade: "0.000" })) ?? "", /sem saldo/);
  });

  it("entrada em lote bloqueado, vencido ou expirado avisa e não bloqueia", () => {
    assert.equal(avisoDaEntrada(lote(), "2026-11-16"), null);
    for (const extras of [{ status_lote: "bloqueado" }, { status_lote: "vencido" }, { data_validade: "2020-01-01" }]) {
      assert.match(avisoDaEntrada(lote(extras), "2026-11-16") ?? "", /entrada é permitida/);
    }
  });

  it("destino obrigatório e diferente da origem; justificativa obrigatória", () => {
    assert.ok(validarDestino(lote(), ""));
    assert.ok(validarDestino(lote(), "5"));
    assert.equal(validarDestino(lote(), "6"), null);
    assert.ok(validarDestino(lote(), "abc"));
    assert.ok(validarDestino(lote(), "2147483648"));
    assert.ok(validarJustificativa("   "));
    assert.ok(validarJustificativa("x".repeat(256)));
    assert.equal(validarJustificativa("Reposição"), null);
    assert.ok(validarJustificativa("Repo\u0000sição"));
  });
});

describe("falhas da API em movimentações", () => {
  const api = (status: number, codigo: string, mensagem: string, campos: { campo: string; mensagem: string }[] = []) => new ErroDaApi(status, codigo, mensagem, campos);

  it("400 mapeia campos; 422 usa a mensagem da regra; 404 atualiza o lote", () => {
    assert.deepEqual(interpretarFalhaDeMovimentacao(api(400, "VALIDACAO", "x", [{ campo: "quantidade", mensagem: "Quantidade inválida" }])).campos, { quantidade: "Quantidade inválida" });
    const regra = interpretarFalhaDeMovimentacao(api(422, "LOTE_INDISPONIVEL", "Saída não permitida para lote vencido"));
    assert.equal(regra.geral, "Saída não permitida para lote vencido");
    assert.equal(regra.atualizarLote, true);
    assert.equal(interpretarFalhaDeMovimentacao(api(404, "NAO_ENCONTRADO", "x")).geral, "Lote não encontrado.");
  });

  it("409 LOTE_EM_USO e SALDO_INSUFICIENTE pedem para tentar de novo e atualizar o saldo", () => {
    const emUso = interpretarFalhaDeMovimentacao(api(409, "LOTE_EM_USO", "x"));
    assert.match(emUso.geral ?? "", /em uso/);
    assert.equal(emUso.atualizarLote, true);
    assert.equal(emUso.incerta, false);
    const saldo = interpretarFalhaDeMovimentacao(api(409, "SALDO_INSUFICIENTE", "x"));
    assert.match(saldo.geral ?? "", /Saldo insuficiente/);
    assert.equal(saldo.atualizarLote, true);
  });

  it("503 manda tentar de novo; 500 e falha de rede são resultado incerto e mandam conferir o histórico", () => {
    const ocupado = interpretarFalhaDeMovimentacao(api(503, "SERVICO_INDISPONIVEL", "x"));
    assert.match(ocupado.geral ?? "", /ocupado/);
    assert.equal(ocupado.incerta, false);
    const interno = interpretarFalhaDeMovimentacao(api(500, "ERRO_INTERNO", "TypeError at /app/src"));
    assert.equal(interno.incerta, true);
    assert.doesNotMatch(interno.geral ?? "", /TypeError|\/app/);
    for (const motivo of ["SEM_CONEXAO", "TEMPO_ESGOTADO"] as const) {
      const rede = interpretarFalhaDeMovimentacao(new ErroDeRede(motivo, "x"));
      assert.equal(rede.incerta, true);
      assert.match(rede.geral ?? "", /histórico/);
    }
    assert.equal(interpretarFalhaDeMovimentacao(new ErroDeRede("CANCELADO", "x")).incerta, true);
    assert.equal(interpretarFalhaDeMovimentacao(new Error("x")).geral, "Não foi possível concluir a operação.");
  });
});

describe("proteção contra envio duplo", () => {
  it("só uma execução por vez: o segundo disparo enquanto o primeiro não termina é ignorado", async () => {
    const envio = criarEnvioUnico();
    let chamadas = 0;
    let liberar: (() => void) | null = null;
    const tarefa = () => {
      chamadas += 1;
      return new Promise<number>((resolver) => {
        liberar = () => resolver(chamadas);
      });
    };
    const primeira = envio.executar(tarefa);
    const segunda = envio.executar(tarefa);
    const terceira = envio.executar(tarefa);
    assert.ok(primeira !== null);
    assert.equal(segunda, null);
    assert.equal(terceira, null);
    assert.equal(envio.ocupado(), true);
    (liberar as unknown as () => void)();
    assert.equal(await primeira, 1);
    assert.equal(envio.ocupado(), false);
    const nova = envio.executar(() => Promise.resolve(7));
    assert.equal(await nova, 7);
    assert.equal(chamadas, 1);
  });

  it("libera depois de falha e propaga o erro", async () => {
    const envio = criarEnvioUnico();
    const falha = envio.executar(() => Promise.reject(new Error("falhou")));
    await assert.rejects(falha ?? Promise.resolve(), /falhou/);
    assert.equal(envio.ocupado(), false);
    const sincrona = envio.executar<number>(() => {
      throw new Error("síncrona");
    });
    await assert.rejects(sincrona ?? Promise.resolve(), /síncrona/);
    assert.equal(envio.ocupado(), false);
  });

  it("filtro de leitura dupla ignora o mesmo código dentro da janela, mesmo se o leitor gaguejar", () => {
    const aceitar = criarFiltroDeLeituraDupla(1500);
    assert.equal(aceitar("LOTE-1", 0), true);
    assert.equal(aceitar("LOTE-1", 400), false);
    assert.equal(aceitar("LOTE-1", 1800), false);
    assert.equal(aceitar("LOTE-1", 3400), true);
    assert.equal(aceitar("LOTE-2", 3500), true);
    assert.equal(aceitar("LOTE-1", 3600), true);
  });
});

describe("corpos de movimentação", () => {
  it("saldo: normaliza a vírgula, omite motivo e observação vazios e mantém o texto", () => {
    assert.deepEqual(corpoDeSaldo(7, " 10,500 ", " ", ""), { id_lote: 7, quantidade: "10.500" });
    assert.deepEqual(corpoDeSaldo(7, "1", " Compra ", " NF 123 "), { id_lote: 7, quantidade: "1", motivo: "Compra", observacao: "NF 123" });
  });

  it("transferência: destino numérico e justificativa aparada", () => {
    assert.deepEqual(corpoDeTransferencia(7, 9, " Reposição ", ""), { id_lote: 7, id_localizacao_destino: 9, motivo: "Reposição" });
  });
});
