import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { traduzirErroBanco } from "../src/erros-banco.ts";
import { Prisma } from "../src/generated/prisma/client.ts";
import { alterarSaldo } from "../src/services/saldo.service.ts";
import { contextoDe, executarComoUsuario } from "../src/transacao.ts";
import { chamarApi, type RespostaApi } from "./api.ts";
import { criarUsuarioTeste, desativarUsuariosTeste, subir, tokenDe, type Servidor, type UsuarioTeste } from "./helpers.ts";
import { segurarLote } from "./trava.ts";

const D = (valor: string | number): Prisma.Decimal => new Prisma.Decimal(valor);

describe("alterarSaldo (A10)", () => {
  const prefixo = `S${randomUUID().slice(0, 8)}`;
  let servidor: Servidor;
  let usuario: UsuarioTeste;
  let token: string;
  let idProduto: number;
  let idLocalizacao: number;
  const avisos: string[] = [];
  const registrar = (aviso: Error): void => {
    avisos.push(`${aviso.name}: ${aviso.message}`);
  };

  const novoLote = async (sufixo: string, quantidade: string): Promise<number> => {
    const r = await chamarApi(servidor, "POST", "/lotes", token, {
      numero_lote: `${prefixo}-${sufixo}`,
      id_produto: idProduto,
      id_localizacao: idLocalizacao,
      quantidade,
    });
    assert.equal(r.status, 201);
    return (r.corpo as { id_lote: number }).id_lote;
  };
  const saldoDo = async (idLote: number) =>
    (await prisma.lote.findUniqueOrThrow({ where: { id_lote: idLote } })).quantidade.toString();
  const auditoriaDe = async (idLote: number): Promise<number> => {
    const [linha] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM auditoria_log WHERE (valor_novo->>'id_lote')::int = ${idLote}`;
    return Number(linha?.n ?? 0);
  };
  const movimentos = (idLote: number) =>
    prisma.movimentacao.findMany({ where: { id_lote: idLote }, orderBy: { id_movimentacao: "asc" } });

  before(async () => {
    process.on("warning", registrar);
    servidor = await subir(
      createApp((a) => {
        a.post("/_teste/entrada/:id", async (req, res) => {
          const quantidade = D((req.body as { quantidade: string }).quantidade);
          const resultado = await alterarSaldo(contextoDe(req), Number(req.params.id), async (lote) => ({
            tipo: "entrada",
            quantidade,
            saldoPosterior: lote.quantidade.plus(quantidade),
            origem: null,
            destino: lote.id_localizacao,
            noLote: { quantidade: lote.quantidade.plus(quantidade) },
          }));
          res.status(201).json(resultado);
        });
      }),
    );
    usuario = await criarUsuarioTeste("operador");
    token = await tokenDe(usuario);
    idProduto = (await prisma.produto.create({ data: { nome: `${prefixo}-prod`, unidade_medida: "UN" } })).id_produto;
    idLocalizacao = (await prisma.localizacao.create({ data: { corredor: prefixo, nivel: "1", posicao: "A" } }))
      .id_localizacao;
  });

  after(async () => {
    process.off("warning", registrar);
    await servidor.fechar();
    await prisma.produto.updateMany({ where: { nome: { startsWith: prefixo } }, data: { ativo: false } });
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("calcula com Decimal: 0,1 + 0,2 = 0,3 exato, saldo anterior e posterior gravados", async () => {
    const id = await novoLote("dec", "0.1");
    const r = await chamarApi(servidor, "POST", `/_teste/entrada/${id}`, token, { quantidade: "0.2" });
    assert.equal(r.status, 201);
    assert.equal(await saldoDo(id), "0.3");
    const ultima = (await movimentos(id)).at(-1);
    assert.equal(ultima?.saldo_anterior.toString(), "0.1");
    assert.equal(ultima?.saldo_posterior.toString(), "0.3");
    assert.equal(ultima?.saldo_posterior.toString(), await saldoDo(id));
  });

  it("lote antes da movimentação: na auditoria o UPDATE do lote vem antes do INSERT da movimentação", async () => {
    const id = await novoLote("ordem", "1");
    await chamarApi(servidor, "POST", `/_teste/entrada/${id}`, token, { quantidade: "2" });
    const mov = (await movimentos(id)).at(-1);
    const linhas = await prisma.$queryRaw<{ id_log: bigint; tabela_afetada: string; operacao: string; id_usuario: number | null }[]>`
      SELECT id_log, tabela_afetada, operacao::text AS operacao, id_usuario FROM auditoria_log
      WHERE (tabela_afetada = 'lote' AND operacao = 'UPDATE' AND (valor_novo->>'id_lote')::int = ${id})
         OR (tabela_afetada = 'movimentacao' AND (valor_novo->>'id_movimentacao')::bigint = ${mov?.id_movimentacao ?? 0})
      ORDER BY id_log`;
    assert.deepEqual(linhas.map((l) => l.tabela_afetada), ["lote", "movimentacao"]);
    assert.ok(linhas.every((l) => l.id_usuario === usuario.id));
  });

  it("lote inexistente: 404 sem gravar nada", async () => {
    const r = await chamarApi(servidor, "POST", "/_teste/entrada/2000000000", token, { quantidade: "1" });
    assert.equal(r.status, 404);
  });

  it("falha ao inserir a movimentação depois do UPDATE do lote desfaz tudo", async () => {
    const id = await novoLote("atomico", "5");
    const antes = (await movimentos(id)).length;
    const erro = await alterarSaldo({ idUsuario: usuario.id, ip: "" }, id, async (lote) => ({
      tipo: "entrada",
      quantidade: D(0),
      saldoPosterior: lote.quantidade.plus(7),
      origem: null,
      destino: lote.id_localizacao,
      noLote: { quantidade: lote.quantidade.plus(7) },
    })).then(
      () => null,
      (e: unknown) => e,
    );
    const traduzido = traduzirErroBanco(erro);
    assert.equal(traduzido?.status, 422);
    assert.equal(await saldoDo(id), "5");
    assert.equal((await movimentos(id)).length, antes);
  });

  it("lote travado por outra conexão: 409 em cerca de 1,5 s, nada gravado e contexto sem vazar para o pool", async () => {
    const id = await novoLote("trava", "10");
    const movsAntes = (await movimentos(id)).length;
    const auditoriaAntes = await auditoriaDe(id);
    const retencao = await segurarLote(id);
    const inicio = Date.now();
    let r: RespostaApi;
    let duracao: number;
    try {
      r = await chamarApi(servidor, "POST", `/_teste/entrada/${id}`, token, { quantidade: "3" });
      duracao = Date.now() - inicio;
    } finally {
      await retencao.liberar();
    }
    assert.equal(r.status, 409);
    assert.deepEqual(r.corpo, {
      erro: { codigo: "LOTE_EM_USO", mensagem: "O lote está sendo usado por outra operação. Tente novamente" },
    });
    assert.doesNotMatch(r.texto, /55P03|lock|canceling/i);
    assert.ok(duracao >= 1300 && duracao < 4000, `duração ${duracao} ms`);
    assert.equal(await saldoDo(id), "10");
    assert.equal((await movimentos(id)).length, movsAntes);
    assert.equal(await auditoriaDe(id), auditoriaAntes);
    const sessoes = await Promise.all(
      Array.from({ length: 12 }, () =>
        prisma.$queryRaw<{ lt: string; uid: string | null; ip: string | null }[]>`
          SELECT current_setting('lock_timeout') AS lt, current_setting('app.user_id', true) AS uid, current_setting('app.ip', true) AS ip`,
      ),
    );
    for (const s of sessoes) {
      assert.equal(s[0]?.lt, "0");
      assert.ok(s[0]?.uid === null || s[0]?.uid === "");
      assert.ok(s[0]?.ip === null || s[0]?.ip === "");
    }
  });

  it("formatos reais do erro 55P03 (P2010 no SELECT FOR UPDATE e P2039 no UPDATE) viram 409", async () => {
    const id = await novoLote("formatos", "1");
    const retencao = await segurarLote(id);
    const contexto = { idUsuario: usuario.id, ip: "" };
    let bruto: { code?: string } | null;
    let atualizacao: { code?: string } | null;
    try {
      bruto = await executarComoUsuario(
        contexto,
        (tx) => tx.$queryRaw`SELECT id_lote FROM lote WHERE id_lote = ${id} FOR UPDATE`,
        { lockTimeoutMs: 300 },
      ).then(
        () => null,
        (e: unknown) => e as { code?: string },
      );
      atualizacao = await executarComoUsuario(
        contexto,
        (tx) => tx.lote.update({ where: { id_lote: id }, data: { motivo_bloqueio: "x" } }),
        { lockTimeoutMs: 300 },
      ).then(
        () => null,
        (e: unknown) => e as { code?: string },
      );
    } finally {
      await retencao.liberar();
    }
    assert.equal(bruto?.code, "P2010");
    assert.equal(atualizacao?.code, "P2039");
    assert.equal(traduzirErroBanco(bruto)?.status, 409);
    assert.equal(traduzirErroBanco(atualizacao)?.status, 409);
    assert.equal(traduzirErroBanco(bruto)?.codigo, "LOTE_EM_USO");
  });

  it("a suíte de saldo roda sem aviso de consulta concorrente do pg", async () => {
    await new Promise((ok) => setTimeout(ok, 100));
    assert.deepEqual(avisos.filter((a) => a.includes("client.query")), []);
  });
});
