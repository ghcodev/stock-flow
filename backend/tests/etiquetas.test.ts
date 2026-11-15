import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { criarUsuarioTeste, desativarUsuariosTeste, subir, tokenDe, type Servidor } from "./helpers.ts";

type Etiqueta = { id_identificacao: number; tipo_identificacao: string; codigo: string; id_lote: number };

describe("etiquetas (A8)", () => {
  const prefixo = `E${randomUUID().slice(0, 8)}`;
  let servidor: Servidor;
  let operador: string;
  let admin: string;
  let idProduto: number;
  let idLocalizacao: number;

  const novoLote = async (sufixo: string, extra: Record<string, unknown> = {}): Promise<number> => {
    const r = await chamarApi(servidor, "POST", "/lotes", operador, {
      numero_lote: `${prefixo}-${sufixo}`,
      id_produto: idProduto,
      id_localizacao: idLocalizacao,
      ...extra,
    });
    assert.equal(r.status, 201);
    return (r.corpo as { id_lote: number }).id_lote;
  };
  const associar = (idLote: number | string, corpo: unknown, token = operador) =>
    chamarApi(servidor, "POST", `/lotes/${idLote}/etiqueta`, token, corpo);

  before(async () => {
    servidor = await subir(createApp());
    operador = await tokenDe(await criarUsuarioTeste("operador"));
    admin = await tokenDe(await criarUsuarioTeste("administrador"));
    idProduto = (await prisma.produto.create({ data: { nome: `${prefixo}-prod`, unidade_medida: "UN" } })).id_produto;
    idLocalizacao = (await prisma.localizacao.create({ data: { corredor: prefixo, nivel: "1", posicao: "A" } }))
      .id_localizacao;
  });

  after(async () => {
    await servidor.fechar();
    await prisma.produto.updateMany({ where: { nome: { startsWith: prefixo } }, data: { ativo: false } });
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("operador e administrador associam QR Code e RFID a lote sem etiqueta (201)", async () => {
    const lote1 = await novoLote("a");
    const r1 = await associar(lote1, { tipo: "qr_code", codigo: `  QR-${prefixo}-1  ` });
    assert.equal(r1.status, 201);
    const e1 = r1.corpo as Etiqueta;
    assert.deepEqual(
      { t: e1.tipo_identificacao, c: e1.codigo, l: e1.id_lote },
      { t: "qr_code", c: `QR-${prefixo}-1`, l: lote1 },
    );
    const lote2 = await novoLote("b");
    const r2 = await associar(lote2, { tipo: "rfid", codigo: `RF-${prefixo}-2` }, admin);
    assert.equal(r2.status, 201);
    const consulta = (await chamarApi(servidor, "GET", `/lotes/${lote1}`, operador)).corpo as {
      identificacao: { codigo: string } | null;
    };
    assert.equal(consulta.identificacao?.codigo, `QR-${prefixo}-1`);
  });

  it("RN03: lote que já tem etiqueta recusa outra (409)", async () => {
    const lote = await novoLote("c", { etiqueta: { tipo: "qr_code", codigo: `QR-${prefixo}-c` } });
    const r = await associar(lote, { tipo: "rfid", codigo: `RF-${prefixo}-c2` });
    assert.equal(r.status, 409);
    assert.equal((r.corpo as { erro: { codigo: string } }).erro.codigo, "LOTE_COM_ETIQUETA");
    assert.equal(await prisma.identificacao.count({ where: { codigo: `RF-${prefixo}-c2` } }), 0);
  });

  it("RN03: código já usado em outro lote é 409 etiqueta duplicada", async () => {
    const codigo = `QR-${prefixo}-d`;
    await novoLote("d1", { etiqueta: { tipo: "qr_code", codigo } });
    const outro = await novoLote("d2");
    const r = await associar(outro, { tipo: "qr_code", codigo });
    assert.equal(r.status, 409);
    assert.deepEqual(r.corpo, { erro: { codigo: "ETIQUETA_DUPLICADA", mensagem: "Etiqueta já associada a outro lote" } });
  });

  it("associações simultâneas do mesmo código: uma vence e as outras recebem 409", async () => {
    const codigo = `QR-${prefixo}-corrida`;
    const lotes = await Promise.all([novoLote("e1"), novoLote("e2"), novoLote("e3"), novoLote("e4")]);
    const respostas = await Promise.all(lotes.map((l) => associar(l, { tipo: "qr_code", codigo })));
    assert.deepEqual(respostas.map((r) => r.status).sort(), [201, 409, 409, 409]);
    assert.equal(await prisma.identificacao.count({ where: { codigo } }), 1);
  });

  it("validação, lote inexistente 404 e id inválido 400", async () => {
    const lote = await novoLote("f");
    for (const corpo of [{}, { tipo: "barras", codigo: "X" }, { tipo: "rfid" }, { tipo: "rfid", codigo: "" }, { tipo: "rfid", codigo: "x".repeat(129) }, { tipo: "rfid", codigo: 5 }]) {
      const r = await associar(lote, corpo);
      assert.equal(r.status, 400, JSON.stringify(corpo));
    }
    assert.equal((await associar(2_000_000_000, { tipo: "rfid", codigo: `RF-${prefixo}-z` })).status, 404);
    assert.equal((await associar("abc", { tipo: "rfid", codigo: "x" })).status, 400);
    assert.equal(await prisma.identificacao.count({ where: { id_lote: lote } }), 0);
  });

  it("sem token 401; não há rota para alterar ou remover etiqueta", async () => {
    const lote = await novoLote("g");
    assert.equal((await chamarApi(servidor, "POST", `/lotes/${lote}/etiqueta`, undefined, { tipo: "rfid", codigo: "x" })).status, 401);
    assert.equal((await chamarApi(servidor, "DELETE", `/lotes/${lote}/etiqueta`, admin)).status, 404);
    assert.equal((await chamarApi(servidor, "PUT", `/lotes/${lote}/etiqueta`, admin, { tipo: "rfid", codigo: "x" })).status, 404);
  });
});
