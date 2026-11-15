import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { HttpError } from "../src/errors.ts";
import { alterarNaTransacao } from "../src/services/usuario.service.ts";
import { chamarApi } from "./api.ts";
import {
  criarUsuarioTeste,
  desativarUsuariosTeste,
  subir,
  tokenDe,
  type Servidor,
  type UsuarioTeste,
} from "./helpers.ts";

type Usuario = { id_usuario: number; nome: string; email: string; perfil: string; ativo: boolean };
type Lista = { dados: Usuario[]; pagina: number; limite: number; total: number };

class Desfazer extends Error {}

describe("usuários (A9)", () => {
  const sufixo = randomUUID().slice(0, 8);
  const criados: string[] = [];
  let servidor: Servidor;
  let adminUsuario: UsuarioTeste;
  let admin: string;
  let operador: string;

  const email = (nome: string): string => `${nome}-${sufixo}@teste.local`;
  const novo = async (nome: string, extra: Record<string, unknown> = {}) => {
    const corpo = { nome: `Usuario ${nome}`, email: email(nome), senha: `Senha-${nome}-${sufixo}`, perfil: "operador", ...extra };
    const r = await chamarApi(servidor, "POST", "/usuarios", admin, corpo);
    if (r.status === 201) criados.push((r.corpo as Usuario).email);
    return { r, corpo };
  };
  const login = (e: string, senha: string) => chamarApi(servidor, "POST", "/auth/login", undefined, { email: e, senha });
  const auditoria = (id: number) =>
    prisma.$queryRaw<{ id_usuario: number | null; operacao: string; texto: string }[]>`
      SELECT id_usuario, operacao::text AS operacao, (valor_novo::text || coalesce(valor_anterior::text, '')) AS texto
      FROM auditoria_log WHERE tabela_afetada = 'usuario' AND (valor_novo->>'id_usuario')::int = ${id} ORDER BY id_log`;

  before(async () => {
    servidor = await subir(createApp());
    adminUsuario = await criarUsuarioTeste("administrador");
    admin = await tokenDe(adminUsuario);
    operador = await tokenDe(await criarUsuarioTeste("operador"));
  });

  after(async () => {
    await servidor.fechar();
    await prisma.usuario.updateMany({ where: { email: { in: criados } }, data: { ativo: false } });
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("operador recebe 403 e sem token 401 em todas as rotas", async () => {
    const rotas: [string, string, unknown?][] = [
      ["GET", "/usuarios"],
      ["POST", "/usuarios", {}],
      ["GET", `/usuarios/${adminUsuario.id}`],
      ["PATCH", `/usuarios/${adminUsuario.id}`, { nome: "x" }],
      ["POST", `/usuarios/${adminUsuario.id}/inativar`],
    ];
    for (const [metodo, caminho, corpo] of rotas) {
      assert.equal((await chamarApi(servidor, metodo, caminho, operador, corpo)).status, 403, `${metodo} ${caminho}`);
      assert.equal((await chamarApi(servidor, metodo, caminho, undefined, corpo)).status, 401, `${metodo} ${caminho}`);
    }
  });

  it("administrador cria usuário: e-mail normalizado, bcrypt custo 12, sem senha_hash e com auditoria", async () => {
    const senha = `Senha-a-${sufixo}`;
    const r = await chamarApi(servidor, "POST", "/usuarios", admin, {
      nome: "Usuario a",
      email: `  A-${sufixo}@Teste.LOCAL `,
      senha,
      perfil: "operador",
      ativo: false,
      id_usuario: 1,
    });
    assert.equal(r.status, 201);
    const usuario = r.corpo as Usuario;
    criados.push(usuario.email);
    assert.equal(usuario.email, `a-${sufixo}@teste.local`);
    assert.equal(usuario.ativo, true);
    assert.notEqual(usuario.id_usuario, 1);
    assert.doesNotMatch(r.texto, /senha|\$2[aby]\$/i);
    const linha = await prisma.usuario.findUnique({ where: { id_usuario: usuario.id_usuario } });
    assert.equal(bcrypt.getRounds(linha?.senha_hash ?? ""), 12);
    assert.equal((await login(`A-${sufixo}@teste.local`, senha)).status, 200);
    const trilha = await auditoria(usuario.id_usuario);
    assert.equal(trilha.length, 1);
    assert.equal(trilha[0]?.operacao, "INSERT");
    assert.equal(trilha[0]?.id_usuario, adminUsuario.id);
    assert.doesNotMatch(trilha[0]?.texto ?? "", /senha_hash|\$2[aby]\$/);
  });

  it("e-mail duplicado (inclusive em outra caixa) é 409 sem mensagem do banco", async () => {
    assert.equal((await novo("b")).r.status, 201);
    const dup = await chamarApi(servidor, "POST", "/usuarios", admin, {
      nome: "Outro",
      email: email("b").toUpperCase(),
      senha: "uma-senha-longa",
      perfil: "operador",
    });
    assert.equal(dup.status, 409);
    assert.doesNotMatch(dup.texto, /usuario_|unique|duplicate/i);
  });

  it("validação: 400 com campos e sem ecoar a senha", async () => {
    const r = await chamarApi(servidor, "POST", "/usuarios", admin, {
      nome: "",
      email: "nao-e-email",
      senha: "curta",
      perfil: "gerente",
    });
    assert.equal(r.status, 400);
    const campos = (r.corpo as { erro: { campos: { campo: string }[] } }).erro.campos.map((c) => c.campo);
    assert.deepEqual(campos.sort(), ["email", "nome", "perfil", "senha"]);
    assert.doesNotMatch(r.texto, /curta|gerente/);
    const longa = await novo("longa", { senha: "S".repeat(73) });
    assert.equal(longa.r.status, 400);
    assert.doesNotMatch(longa.r.texto, /SSSS/);
    assert.equal((await novo("tipo", { email: ["x@y.zz"] })).r.status, 400);
  });

  it("listar e obter nunca devolvem senha_hash; paginação e filtros", async () => {
    for (const n of ["l1", "l2", "l3"]) assert.equal((await novo(n)).r.status, 201);
    const r = await chamarApi(servidor, "GET", `/usuarios?busca=l-${sufixo}&limite=2`, admin);
    assert.equal(r.status, 200);
    const pagina1 = await chamarApi(servidor, "GET", `/usuarios?busca=-${sufixo}&perfil=operador&ativo=true&limite=2&pagina=1`, admin);
    const lista = pagina1.corpo as Lista;
    assert.equal(lista.limite, 2);
    assert.equal(lista.dados.length, 2);
    assert.ok(lista.total >= 5);
    assert.doesNotMatch(pagina1.texto, /senha|\$2[aby]\$/i);
    const um = await chamarApi(servidor, "GET", `/usuarios/${lista.dados[0]?.id_usuario}`, admin);
    assert.equal(um.status, 200);
    assert.doesNotMatch(um.texto, /senha|\$2[aby]\$/i);
    assert.equal((await chamarApi(servidor, "GET", "/usuarios/2000000000", admin)).status, 404);
    assert.equal((await chamarApi(servidor, "GET", "/usuarios/abc", admin)).status, 400);
    for (const q of ["limite=101", "perfil=x", "ativo=talvez"]) {
      assert.equal((await chamarApi(servidor, "GET", `/usuarios?${q}`, admin)).status, 400, q);
    }
  });

  it("editar: nome, e-mail, perfil e senha; senha nova vale e a antiga não", async () => {
    const { r, corpo } = await novo("c");
    const id = (r.corpo as Usuario).id_usuario;
    const novaSenha = `Nova-${sufixo}-123`;
    const alterado = await chamarApi(servidor, "PATCH", `/usuarios/${id}`, admin, {
      nome: "Renomeado",
      email: `Novo-C-${sufixo}@teste.local`,
      perfil: "administrador",
      senha: novaSenha,
      ativo: false,
    });
    assert.equal(alterado.status, 200);
    const u = alterado.corpo as Usuario;
    criados.push(u.email);
    assert.equal(u.nome, "Renomeado");
    assert.equal(u.email, `novo-c-${sufixo}@teste.local`);
    assert.equal(u.perfil, "administrador");
    assert.equal(u.ativo, true);
    assert.doesNotMatch(alterado.texto, /senha|\$2[aby]\$/i);
    assert.equal((await login(u.email, novaSenha)).status, 200);
    assert.equal((await login(u.email, corpo.senha)).status, 401);
    const trilha = await auditoria(id);
    assert.deepEqual(trilha.map((t) => t.operacao), ["INSERT", "UPDATE"]);
    assert.equal(trilha[1]?.id_usuario, adminUsuario.id);
    assert.doesNotMatch(trilha[1]?.texto ?? "", /senha_hash|\$2[aby]\$/);
    assert.equal((await chamarApi(servidor, "PATCH", `/usuarios/${id}`, admin, {})).status, 400);
    assert.equal((await chamarApi(servidor, "PATCH", "/usuarios/2000000000", admin, { nome: "x" })).status, 404);
  });

  it("editar para um e-mail já usado é 409", async () => {
    const a = (await novo("d1")).r.corpo as Usuario;
    await novo("d2");
    const r = await chamarApi(servidor, "PATCH", `/usuarios/${a.id_usuario}`, admin, { email: email("d2") });
    assert.equal(r.status, 409);
  });

  it("inativar: usuário deixa de entrar, token antigo cai e a linha continua existindo", async () => {
    const { r, corpo } = await novo("e");
    const alvo = r.corpo as Usuario;
    const tokenAlvo = await tokenDe({ id: alvo.id_usuario, perfil: "operador" } as UsuarioTeste);
    assert.equal((await chamarApi(servidor, "GET", "/auth/me", tokenAlvo)).status, 200);
    const inativado = await chamarApi(servidor, "POST", `/usuarios/${alvo.id_usuario}/inativar`, admin);
    assert.equal(inativado.status, 200);
    assert.equal((inativado.corpo as Usuario).ativo, false);
    assert.equal((await login(alvo.email, corpo.senha)).status, 401);
    assert.equal((await chamarApi(servidor, "GET", "/auth/me", tokenAlvo)).status, 401);
    assert.equal(await prisma.usuario.count({ where: { id_usuario: alvo.id_usuario } }), 1);
    assert.equal((await chamarApi(servidor, "DELETE", `/usuarios/${alvo.id_usuario}`, admin)).status, 404);
    assert.equal((await chamarApi(servidor, "POST", "/usuarios/2000000000/inativar", admin)).status, 404);
    const trilha = await auditoria(alvo.id_usuario);
    assert.deepEqual(trilha.map((t) => t.operacao), ["INSERT", "UPDATE"]);
  });

  it("o administrador não pode inativar a si mesmo", async () => {
    const r = await chamarApi(servidor, "POST", `/usuarios/${adminUsuario.id}/inativar`, admin);
    assert.equal(r.status, 409);
    assert.equal((r.corpo as { erro: { codigo: string } }).erro.codigo, "AUTO_INATIVACAO");
    const depois = await prisma.usuario.findUnique({ where: { id_usuario: adminUsuario.id } });
    assert.equal(depois?.ativo, true);
  });

  it("rebaixar o próprio perfil é permitido quando existe outro administrador ativo", async () => {
    const proprio = await criarUsuarioTeste("administrador");
    const r = await chamarApi(servidor, "PATCH", `/usuarios/${proprio.id}`, await tokenDe(proprio), { perfil: "operador" });
    assert.equal(r.status, 200);
    assert.equal((r.corpo as Usuario).perfil, "operador");
  });

  it("o último administrador ativo não pode ser inativado nem rebaixado (transação desfeita)", async () => {
    const alvo = await criarUsuarioTeste("administrador");
    let resultados: string[] = [];
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await tx.usuario.updateMany({
          where: { perfil: "administrador", ativo: true, id_usuario: { not: alvo.id } },
          data: { ativo: false },
        });
        const tentativas = [{ perfil: "operador" as const }, { ativo: false }];
        for (const mudanca of tentativas) {
          const erro = await alterarNaTransacao(tx, 0, alvo.id, mudanca).then(
            () => null,
            (e: unknown) => e,
          );
          assert.ok(erro instanceof HttpError);
          resultados = [...resultados, `${erro.status}:${erro.codigo}`];
        }
        throw new Desfazer("desfazer");
      }),
      Desfazer,
    );
    assert.deepEqual(resultados, ["409:ULTIMO_ADMINISTRADOR", "409:ULTIMO_ADMINISTRADOR"]);
    const ativos = await prisma.usuario.count({ where: { perfil: "administrador", ativo: true } });
    assert.ok(ativos >= 2);
  });
});
