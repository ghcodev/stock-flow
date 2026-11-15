import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { contextoDe, executarComoUsuario } from "../src/transacao.ts";
import {
  criarUsuarioTeste,
  desativarUsuariosTeste,
  subir,
  tokenDe,
  type Servidor,
  type UsuarioTeste,
} from "./helpers.ts";

type LinhaAuditoria = { id_usuario: number | null; ip: string | null; nome: string };

describe("escrita com usuário e IP na auditoria", () => {
  const prefixo = `tx-${randomUUID()}@teste.local`;
  let servidor: Servidor;
  let usuarios: UsuarioTeste[];
  let tokens: string[];

  const escrever = (indice: number, nome: string): Promise<Response> =>
    fetch(`${servidor.url}/_teste/escrita`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokens[indice]}` },
      body: JSON.stringify({ nome }),
    });

  const auditoriaDe = (nomes: string[]): Promise<LinhaAuditoria[]> =>
    prisma.$queryRaw<LinhaAuditoria[]>`
      SELECT id_usuario, host(ip_usuario) AS ip, valor_novo->>'email' AS nome
      FROM auditoria_log
      WHERE operacao = 'INSERT' AND valor_novo->>'email' = ANY(${nomes})`;

  before(async () => {
    servidor = await subir(
      createApp((a) => {
        a.post("/_teste/escrita", async (req, res) => {
          const nome = (req.body as { nome: string }).nome;
          await executarComoUsuario(contextoDe(req), (tx) =>
            tx.usuario.create({
              data: { nome: "Tx", email: nome, senha_hash: "x".repeat(60), perfil: "operador", ativo: false },
            }),
          );
          res.status(201).json({ ok: true });
        });
      }),
    );
    usuarios = [await criarUsuarioTeste("operador"), await criarUsuarioTeste("administrador")];
    tokens = await Promise.all(usuarios.map((u) => tokenDe(u)));
  });

  after(async () => {
    await servidor.fechar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("uma escrita pela API grava id_usuario e ip corretos na auditoria", async () => {
    const nome = `unica-${prefixo}`;
    assert.equal((await escrever(0, nome)).status, 201);
    const linhas = await auditoriaDe([nome]);
    assert.equal(linhas.length, 1);
    assert.equal(linhas[0]?.id_usuario, usuarios[0]?.id);
    assert.match(linhas[0]?.ip ?? "", /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/);
  });

  it("requisições simultâneas de usuários diferentes não trocam o id entre si", async () => {
    const pedidos = Array.from({ length: 24 }, (_, i) => ({ indice: i % 2, nome: `c${i}-${prefixo}` }));
    const respostas = await Promise.all(pedidos.map((p) => escrever(p.indice, p.nome)));
    assert.ok(respostas.every((r) => r.status === 201));
    const linhas = await auditoriaDe(pedidos.map((p) => p.nome));
    assert.equal(linhas.length, pedidos.length);
    for (const pedido of pedidos) {
      const linha = linhas.find((l) => l.nome === pedido.nome);
      assert.equal(linha?.id_usuario, usuarios[pedido.indice]?.id, pedido.nome);
    }
  });

  it("o contexto não vaza para a conexão depois da transação", async () => {
    const lidas = await Promise.all(
      Array.from({ length: 15 }, () =>
        prisma.$queryRaw<{ v: string | null }[]>`SELECT current_setting('app.user_id', true) AS v`,
      ),
    );
    assert.ok(lidas.every((l) => l[0]?.v === null || l[0]?.v === ""));
  });

  it("erro dentro da transação desfaz a escrita e o contexto", async () => {
    const nome = `rollback-${prefixo}`;
    await assert.rejects(
      executarComoUsuario({ idUsuario: usuarios[0]?.id ?? 0, ip: "" }, async (tx) => {
        await tx.usuario.create({
          data: { nome: "Tx", email: nome, senha_hash: "x".repeat(60), perfil: "operador", ativo: false },
        });
        throw new Error("falha proposital");
      }),
    );
    assert.equal(await prisma.usuario.count({ where: { email: nome } }), 0);
  });
});
