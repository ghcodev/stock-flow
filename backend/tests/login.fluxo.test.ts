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

async function falhaDo(
  encontrado: UsuarioParaLogin | null,
  senhaConfere: boolean,
  hashEsperado: string,
): Promise<void> {
  const { buscarPorEmail, comparar, login } = montar(encontrado, senhaConfere);
  const erro = await login("fulano@teste.local", "qualquer").then(
    () => null,
    (e: unknown) => e,
  );
  assert.ok(erro instanceof HttpError);
  assert.equal(erro.status, 401);
  assert.equal(erro.codigo, "CREDENCIAIS_INVALIDAS");
  assert.equal(erro.message, "E-mail ou senha inválidos");
  assert.equal(erro.campos, undefined);
  assert.equal(buscarPorEmail.mock.callCount(), 1);
  assert.equal(comparar.mock.callCount(), 1);
  assert.deepEqual(comparar.mock.calls[0]?.arguments, ["qualquer", hashEsperado]);
}

describe("fluxo do login", () => {
  it("o hash de reserva é bcrypt de custo 12", () => {
    assert.equal(bcrypt.getRounds(HASH_RESERVA), 12);
  });

  it("senha errada: uma consulta, uma comparação e 401 padrão", () =>
    falhaDo(usuario(true), false, HASH_DO_USUARIO));

  it("usuário inativo com senha certa: uma consulta, uma comparação e 401 padrão", () =>
    falhaDo(usuario(false), true, HASH_DO_USUARIO));

  it("e-mail inexistente: uma consulta, comparação contra o hash de reserva e 401 padrão", () =>
    falhaDo(null, false, HASH_RESERVA));

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
