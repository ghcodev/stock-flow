import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { criarUsuarioTeste, desativarUsuariosTeste, subir, tokenDe, type Servidor, type UsuarioTeste } from "./helpers.ts";

describe("troca da própria senha (A22)", () => {
  let servidor: Servidor;
  const antigos: Servidor[] = [];

  const renovar = async (): Promise<void> => {
    antigos.push(servidor);
    servidor = await subir(createApp());
  };

  const trocar = (token: string | undefined, corpo: unknown) => chamarApi(servidor, "POST", "/auth/senha", token, corpo);
  const entrar = (email: string, senha: string) => chamarApi(servidor, "POST", "/auth/login", undefined, { email, senha });
  const hashDe = async (u: UsuarioTeste): Promise<string> =>
    (await prisma.usuario.findUniqueOrThrow({ where: { id_usuario: u.id } })).senha_hash;

  before(async () => {
    servidor = await subir(createApp());
  });

  after(async () => {
    for (const antigo of antigos) await antigo.fechar();
    await servidor.fechar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("operador e administrador trocam a própria senha: 204, bcrypt custo 12, login novo vale e o antigo não", async () => {
    await renovar();
    for (const perfil of ["operador", "administrador"] as const) {
      const u = await criarUsuarioTeste(perfil);
      const token = await tokenDe(u);
      const nova = `Nova-${u.senha}`;
      const r = await trocar(token, { senha_atual: u.senha, nova_senha: nova });
      assert.equal(r.status, 204);
      assert.equal(r.texto, "");
      assert.equal(bcrypt.getRounds(await hashDe(u)), 12);
      assert.equal((await entrar(u.email, nova)).status, 200);
      assert.equal((await entrar(u.email, u.senha)).status, 401);
    }
  });

  it("senha atual errada: 422 fixo, nada muda e nada é auditado", async () => {
    await renovar();
    const u = await criarUsuarioTeste("operador");
    const token = await tokenDe(u);
    const antes = await hashDe(u);
    const [{ n: auditoriaAntes }] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM auditoria_log WHERE tabela_afetada = 'usuario' AND (valor_novo->>'id_usuario')::int = ${u.id}`;
    const r = await trocar(token, { senha_atual: "errada-errada", nova_senha: "NovaSenha-1234" });
    assert.equal(r.status, 422);
    assert.deepEqual(r.corpo, { erro: { codigo: "SENHA_ATUAL_INCORRETA", mensagem: "Senha atual incorreta" } });
    assert.doesNotMatch(r.texto, /errada|NovaSenha/);
    assert.equal(await hashDe(u), antes);
    const [{ n: auditoriaDepois }] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM auditoria_log WHERE tabela_afetada = 'usuario' AND (valor_novo->>'id_usuario')::int = ${u.id}`;
    assert.equal(auditoriaDepois, auditoriaAntes);
  });

  it("a troca é auditada com o próprio usuário e sem senha_hash", async () => {
    await renovar();
    const u = await criarUsuarioTeste("operador");
    const token = await tokenDe(u);
    assert.equal((await trocar(token, { senha_atual: u.senha, nova_senha: "OutraSenha-9876" })).status, 204);
    const linhas = await prisma.$queryRaw<{ operacao: string; id_usuario: number | null; texto: string }[]>`
      SELECT operacao::text AS operacao, id_usuario, (valor_novo::text || coalesce(valor_anterior::text, '')) AS texto
      FROM auditoria_log WHERE tabela_afetada = 'usuario' AND (valor_novo->>'id_usuario')::int = ${u.id} ORDER BY id_log DESC LIMIT 1`;
    assert.equal(linhas[0]?.operacao, "UPDATE");
    assert.equal(linhas[0]?.id_usuario, u.id);
    assert.doesNotMatch(linhas[0]?.texto ?? "", /senha_hash|\$2[aby]\$/);
  });

  it("validação da nova senha e da atual: 400 sem ecoar valores", async () => {
    await renovar();
    const u = await criarUsuarioTeste("operador");
    const token = await tokenDe(u);
    const antes = await hashDe(u);
    const base = { senha_atual: u.senha, nova_senha: "NovaSenha-1234" };
    const casos: unknown[] = [
      {},
      { ...base, nova_senha: undefined },
      { ...base, senha_atual: undefined },
      { ...base, nova_senha: "curta" },
      { ...base, nova_senha: "S".repeat(73) },
      { ...base, nova_senha: `abcd\u0000efghijkl` },
      { ...base, senha_atual: `abc\u0000def` },
      { ...base, nova_senha: ["NovaSenha-1234"] },
      { ...base, senha_atual: { a: 1 } },
      { ...base, senha_atual: "" },
      { ...base, nova_senha: "ç".repeat(37) },
    ];
    let enviados = 0;
    for (const corpo of casos) {
      if (enviados++ === 6) await renovar();
      const r = await trocar(token, corpo);
      assert.equal(r.status, 400, JSON.stringify(corpo));
      assert.doesNotMatch(r.texto, /NovaSenha|SSSS/);
    }
    assert.equal(await hashDe(u), antes);
  });

  it("sem token 401; o token antigo segue valendo depois da troca (limite conhecido, documentado)", async () => {
    await renovar();
    assert.equal((await trocar(undefined, { senha_atual: "x", nova_senha: "NovaSenha-1234" })).status, 401);
    const u = await criarUsuarioTeste("operador");
    const token = await tokenDe(u);
    assert.equal((await trocar(token, { senha_atual: u.senha, nova_senha: "NovaSenha-1234" })).status, 204);
    assert.equal((await chamarApi(servidor, "GET", "/auth/me", token)).status, 200);
  });

  it("limitador de tentativas: a 11ª resposta é 429, inclusive com JSON malformado", async () => {
    const outro = await subir(createApp());
    try {
      for (let i = 0; i < 10; i++) {
        const res = await fetch(`${outro.url}/auth/senha`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{invalido",
        });
        assert.equal(res.status, 400);
      }
      const res = await fetch(`${outro.url}/auth/senha`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      assert.equal(res.status, 429);
      const corpo = (await res.json()) as { erro: { codigo: string } };
      assert.equal(corpo.erro.codigo, "MUITAS_TENTATIVAS");
    } finally {
      await outro.fechar();
    }
  });
});
