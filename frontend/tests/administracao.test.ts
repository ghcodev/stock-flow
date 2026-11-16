import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ErroDaApi } from "../src/api/erros.ts";
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
