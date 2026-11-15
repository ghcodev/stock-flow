import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { HttpError } from "../src/errors.ts";
import { criarLogin, HASH_RESERVA, type UsuarioParaLogin } from "../src/services/auth.service.ts";

const HASH_DO_USUARIO = "$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function usuario(ativo: boolean): UsuarioParaLogin {
  return {
    id_usuario: 7,
    nome: "Fulano",
    email: "fulano@teste.local",
    perfil: "operador",
    ativo,
    senha_hash: HASH_DO_USUARIO,
  };
}

function montar(encontrado: UsuarioParaLogin | null, senhaConfere: boolean) {
  const buscarPorEmail = mock.fn(async (_email: string) => encontrado);
  const comparar = mock.fn(async (_senha: string, _hash: string) => senhaConfere);
  return { buscarPorEmail, comparar, login: criarLogin({ buscarPorEmail, comparar }) };
}

describe("fluxo do login", () => {
  it("o hash de reserva é bcrypt de custo 12", () => {
    assert.equal(bcrypt.getRounds(HASH_RESERVA), 12);
  });

  const falhas: [string, UsuarioParaLogin | null, boolean, string][] = [
    ["senha errada", usuario(true), false, HASH_DO_USUARIO],
    ["usuário inativo com senha certa", usuario(false), true, HASH_DO_USUARIO],
    ["e-mail inexistente", null, false, HASH_RESERVA],
  ];

  const erros: HttpError[] = [];

  for (const [nome, encontrado, confere, hashEsperado] of falhas) {
    it(`${nome}: uma consulta, uma comparação bcrypt e 401 padrão`, async () => {
      const { buscarPorEmail, comparar, login } = montar(encontrado, confere);
      const erro = await login("fulano@teste.local", "qualquer").then(
        () => null,
        (e: unknown) => e,
      );
      assert.ok(erro instanceof HttpError);
      erros.push(erro);
      assert.equal(buscarPorEmail.mock.callCount(), 1);
      assert.equal(comparar.mock.callCount(), 1);
      assert.deepEqual(comparar.mock.calls[0]?.arguments, ["qualquer", hashEsperado]);
    });
  }

  it("as três falhas produzem exatamente o mesmo erro", () => {
    assert.equal(erros.length, 3);
    for (const erro of erros) {
      assert.equal(erro.status, 401);
      assert.equal(erro.codigo, "CREDENCIAIS_INVALIDAS");
      assert.equal(erro.message, "E-mail ou senha inválidos");
      assert.equal(erro.campos, undefined);
    }
  });

  it("sucesso: uma consulta, uma comparação, sem senha_hash na resposta", async () => {
    const { buscarPorEmail, comparar, login } = montar(usuario(true), true);
    const resultado = await login("fulano@teste.local", "certa");
    assert.equal(buscarPorEmail.mock.callCount(), 1);
    assert.equal(comparar.mock.callCount(), 1);
    assert.deepEqual(resultado.usuario, {
      id_usuario: 7,
      nome: "Fulano",
      email: "fulano@teste.local",
      perfil: "operador",
    });
    assert.doesNotMatch(JSON.stringify(resultado), /senha_hash|\$2b\$/);
  });
});
