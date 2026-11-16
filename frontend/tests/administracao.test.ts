import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ErroDaApi } from "../src/api/erros.ts";
import {
  corpoDeContagem,
  divergenciaDaContagem,
  idDeContagemValido,
  interpretarFalhaDeContagem,
  interpretarFalhaDeDecisao,
  preverFinalizacao,
  textoDaDivergencia,
  tomDaDivergencia,
  validarContagem,
} from "../src/util/inventario.ts";
import { interpretarFalhaDeMovimentacao } from "../src/util/movimentacao.ts";
import {
  VALORES_DE_USUARIO_VAZIOS,
  corpoDeCriacao,
  corpoDeEdicao,
  interpretarFalhaDeTrocaDeSenha,
  interpretarFalhaDeUsuario,
  semAlteracao,
  validarSenha,
  validarTrocaDeSenha,
  validarUsuario,
} from "../src/util/usuarios.ts";

describe("senha: mínimo de 8, máximo de 72 bytes, sem NUL", () => {
  it("aceita 8 caracteres e recusa 7", () => {
    assert.equal(validarSenha("12345678"), null);
    assert.notEqual(validarSenha("1234567"), null);
  });

  it("conta bytes UTF-8, não caracteres", () => {
    assert.equal(validarSenha("a".repeat(72)), null);
    assert.notEqual(validarSenha("a".repeat(73)), null);
    assert.equal(validarSenha("é".repeat(36)), null);
    assert.notEqual(validarSenha("é".repeat(37)), null);
  });

  it("conta pontos de código no mínimo (emoji vale um)", () => {
    assert.notEqual(validarSenha("😀".repeat(7)), null);
    assert.equal(validarSenha("😀".repeat(8)), null);
  });

  it("recusa NUL", () => {
    assert.notEqual(validarSenha("abcdefg\u0000h"), null);
  });
});

describe("troca da própria senha", () => {
  it("exige atual, nova válida, diferente da atual e confirmação igual", () => {
    assert.deepEqual(validarTrocaDeSenha("antiga123", "novaSenha1", "novaSenha1"), {});
    assert.ok(validarTrocaDeSenha("", "novaSenha1", "novaSenha1")["senha_atual"]);
    assert.ok(validarTrocaDeSenha("antiga123", "curta", "curta")["nova_senha"]);
    assert.ok(validarTrocaDeSenha("igual1234", "igual1234", "igual1234")["nova_senha"]);
    assert.ok(validarTrocaDeSenha("antiga123", "novaSenha1", "outraSenha")["confirmacao"]);
    assert.ok(validarTrocaDeSenha("antiga123", "novaSenha1", "")["confirmacao"]);
  });

  it("SENHA_ATUAL_INCORRETA vai para o campo e 429 informa a espera", () => {
    const campo = interpretarFalhaDeTrocaDeSenha(new ErroDaApi(422, "SENHA_ATUAL_INCORRETA", "Senha atual incorreta"));
    assert.deepEqual(Object.keys(campo.campos), ["senha_atual"]);
    assert.equal(campo.geral, null);
    const limite = interpretarFalhaDeTrocaDeSenha(new ErroDaApi(429, "MUITAS_TENTATIVAS", "x", [], 42));
    assert.match(limite.geral ?? "", /42 s/);
    assert.equal(limite.segundosParaRepetir, 42);
    const semEspera = interpretarFalhaDeTrocaDeSenha(new ErroDaApi(429, "MUITAS_TENTATIVAS", "x"));
    assert.match(semEspera.geral ?? "", /Aguarde/);
  });
});

describe("formulário de usuário", () => {
  const completo = { nome: " Ana Lima ", email: " ANA@Exemplo.com ", perfil: "operador", senha: "senhaSegura1" };

  it("criação exige tudo; edição aceita senha em branco", () => {
    assert.deepEqual(validarUsuario(completo, true), {});
    assert.deepEqual(Object.keys(validarUsuario(VALORES_DE_USUARIO_VAZIOS, true)).sort(), ["email", "nome", "perfil", "senha"]);
    assert.deepEqual(validarUsuario({ ...completo, senha: "" }, false), {});
    assert.ok(validarUsuario({ ...completo, senha: "curta" }, false)["senha"]);
  });

  it("valida e-mail, perfil, tamanhos e NUL", () => {
    assert.ok(validarUsuario({ ...completo, email: "sem-arroba" }, true)["email"]);
    assert.ok(validarUsuario({ ...completo, email: `${"a".repeat(160)}@x.com` }, true)["email"]);
    assert.ok(validarUsuario({ ...completo, perfil: "root" }, true)["perfil"]);
    assert.ok(validarUsuario({ ...completo, nome: "x".repeat(121) }, true)["nome"]);
    assert.ok(validarUsuario({ ...completo, nome: "a\u0000b" }, true)["nome"]);
  });

  it("corpo de criação normaliza e corpo de edição envia só o que mudou", () => {
    assert.deepEqual(corpoDeCriacao(completo), { nome: "Ana Lima", email: "ana@exemplo.com", perfil: "operador", senha: "senhaSegura1" });
    const original = { nome: "Ana Lima", email: "ana@exemplo.com", perfil: "operador" as const };
    assert.deepEqual(corpoDeEdicao({ nome: "Ana Lima", email: "ANA@exemplo.com", perfil: "operador", senha: "" }, original), {});
    assert.equal(semAlteracao({}), true);
    assert.deepEqual(corpoDeEdicao({ nome: "Ana L.", email: "ana@exemplo.com", perfil: "administrador", senha: "outraSenha1" }, original), {
      nome: "Ana L.",
      perfil: "administrador",
      senha: "outraSenha1",
    });
  });

  it("e-mail duplicado vai para o campo; último administrador e autoinativação ficam como mensagem geral", () => {
    const duplicado = interpretarFalhaDeUsuario(new ErroDaApi(409, "REGISTRO_DUPLICADO", "Registro já existente"));
    assert.deepEqual(Object.keys(duplicado.campos), ["email"]);
    const ultimo = interpretarFalhaDeUsuario(new ErroDaApi(409, "ULTIMO_ADMINISTRADOR", "O sistema não pode ficar sem administrador ativo"));
    assert.equal(ultimo.geral, "O sistema não pode ficar sem administrador ativo");
    const auto = interpretarFalhaDeUsuario(new ErroDaApi(409, "AUTO_INATIVACAO", "O administrador não pode inativar a si mesmo"));
    assert.equal(auto.geral, "O administrador não pode inativar a si mesmo");
  });
});

describe("W5: mensagem neutra no 503", () => {
  it("não afirma que o saldo já foi recarregado, mas pede para recarregar o lote", () => {
    const falha = interpretarFalhaDeMovimentacao(new ErroDaApi(503, "SERVICO_OCUPADO", "x"));
    assert.equal(falha.atualizarLote, true);
    assert.doesNotMatch(falha.geral ?? "", /recarregad/);
  });
});

describe("inventário rotativo (F8b)", () => {
  it("divergência em decimal exato, sem Number", () => {
    assert.equal(divergenciaDaContagem("10.3", "10.1"), "0.2");
    assert.equal(divergenciaDaContagem("0", "5"), "-5");
    assert.equal(divergenciaDaContagem("999999999.999", "999999999.998"), "0.001");
    assert.equal(divergenciaDaContagem("1", "1"), "0");
    assert.equal(tomDaDivergencia("0.001"), "sobra");
    assert.equal(tomDaDivergencia("-0.001"), "falta");
    assert.equal(tomDaDivergencia("0"), "zero");
    assert.equal(textoDaDivergencia("2.5", (v) => v), "+2.5");
    assert.equal(textoDaDivergencia("-2.5", (v) => v), "-2.5");
  });

  it("a divergência é somada ao saldo ATUAL, não ao da contagem", () => {
    assert.deepEqual(preverFinalizacao("12", "-5"), { saldoFinal: "7", problema: null });
    assert.deepEqual(preverFinalizacao("3", "-5"), { saldoFinal: "-2", problema: "negativo" });
    assert.deepEqual(preverFinalizacao("999999999.999", "0.001"), { saldoFinal: "1000000000", problema: "excede" });
  });

  it("contagem: zero permitido, 3 casas, sem negativo, observação limitada", () => {
    assert.deepEqual(validarContagem("0", ""), {});
    assert.deepEqual(validarContagem("12,345", ""), {});
    assert.ok(validarContagem("", "")["quantidade"]);
    assert.ok(validarContagem("1,2345", "")["quantidade"]);
    assert.ok(validarContagem("-1", "")["quantidade"]);
    assert.ok(validarContagem("1", "x".repeat(5001))["observacao"]);
    assert.deepEqual(corpoDeContagem(7, "12,5", "  ok "), { id_lote: 7, quantidade_contada: "12.5", observacao: "ok" });
    assert.deepEqual(corpoDeContagem(7, "0", " "), { id_lote: 7, quantidade_contada: "0" });
  });

  it("falhas: segunda contagem pendente, já finalizada, saldo negativo, excede limite", () => {
    assert.equal(interpretarFalhaDeContagem(new ErroDaApi(409, "CONTAGEM_PENDENTE_EXISTENTE", "O lote já tem uma contagem pendente de finalização")).geral, "O lote já tem uma contagem pendente de finalização");
    const ja = interpretarFalhaDeDecisao(new ErroDaApi(409, "CONTAGEM_JA_FINALIZADA", "x"));
    assert.equal(ja.atualizarLista, true);
    assert.match(interpretarFalhaDeDecisao(new ErroDaApi(409, "SALDO_FINAL_NEGATIVO", "x")).geral, /negativo/);
    assert.match(interpretarFalhaDeDecisao(new ErroDaApi(422, "SALDO_EXCEDE_LIMITE", "x")).geral, /limite/);
    assert.equal(interpretarFalhaDeDecisao(new ErroDaApi(500, "ERRO_DO_SERVIDOR", "x")).incerta, true);
  });

  it("id de contagem só aceita inteiro positivo", () => {
    assert.equal(idDeContagemValido("123"), true);
    for (const ruim of ["", "0", "01", "1/../2", "1%2f", "a", "1".repeat(19)]) assert.equal(idDeContagemValido(ruim), false, ruim);
  });
});

describe("ajuste de estoque (F8c)", () => {
  it("justificativa de 10 a 255 caracteres depois de aparar", async () => {
    const { validarJustificativaDoAjuste } = await import("../src/util/ajuste.ts");
    assert.notEqual(validarJustificativaDoAjuste("         curto    "), null);
    assert.equal(validarJustificativaDoAjuste("  dez chars!  "), null);
    assert.equal(validarJustificativaDoAjuste("x".repeat(255)), null);
    assert.notEqual(validarJustificativaDoAjuste("x".repeat(256)), null);
    assert.notEqual(validarJustificativaDoAjuste("justificativa\u0000ok"), null);
  });

  it("novo saldo: obrigatório, decimal, diferente do atual (comparação exata)", async () => {
    const { validarAjuste } = await import("../src/util/ajuste.ts");
    const lote = { quantidade: "10.5" };
    assert.deepEqual(validarAjuste(lote, "11", "justificativa longa"), {});
    assert.deepEqual(validarAjuste(lote, "0", "justificativa longa"), {});
    assert.ok(validarAjuste(lote, "", "justificativa longa")["novo_saldo"]);
    assert.ok(validarAjuste(lote, "10,500", "justificativa longa")["novo_saldo"]);
    assert.ok(validarAjuste(lote, "1,2345", "justificativa longa")["novo_saldo"]);
    assert.ok(validarAjuste(lote, "-1", "justificativa longa")["novo_saldo"]);
    assert.ok(validarAjuste(lote, "11", "curta")["motivo"]);
  });

  it("envia saldo_exibido exatamente como veio da API e normaliza só o novo saldo", async () => {
    const { corpoDeAjuste } = await import("../src/util/ajuste.ts");
    assert.deepEqual(corpoDeAjuste({ id_lote: 3, quantidade: "10.500" }, "12,5", "  motivo bem longo  "), { id_lote: 3, saldo_exibido: "10.500", novo_saldo: "12.5", motivo: "motivo bem longo" });
  });

  it("SALDO_DESATUALIZADO avisa e manda recarregar sem reenviar; 422 sem alteração vai ao campo; lote bloqueado só avisa", async () => {
    const { interpretarFalhaDeAjuste, avisoDoAjuste } = await import("../src/util/ajuste.ts");
    const desatualizado = interpretarFalhaDeAjuste(new ErroDaApi(409, "SALDO_DESATUALIZADO", "x"));
    assert.equal(desatualizado.atualizarLote, true);
    assert.equal(desatualizado.incerta, false);
    assert.match(desatualizado.geral ?? "", /mudou/);
    assert.deepEqual(Object.keys(interpretarFalhaDeAjuste(new ErroDaApi(422, "AJUSTE_SEM_ALTERACAO", "x")).campos), ["novo_saldo"]);
    assert.match(avisoDoAjuste({ status_lote: "bloqueado" }) ?? "", /bloqueado/);
    assert.match(avisoDoAjuste({ status_lote: "ativo", validade_expirada: true }) ?? "", /validade/);
    assert.equal(avisoDoAjuste({ status_lote: "ativo" }), null);
  });
});
