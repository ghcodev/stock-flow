import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { literalParaLike } from "../src/busca.ts";
import { chamarApi } from "./api.ts";
import { criarUsuarioTeste, desativarUsuariosTeste, subir, tokenDe, type Servidor } from "./helpers.ts";

type Lista = { dados: { nome?: string; numero_lote?: string; corredor?: string }[]; total: number };

describe("busca trata % e _ como texto literal", () => {
  const prefixo = `B${randomUUID().slice(0, 8)}`;
  let servidor: Servidor;
  let admin: string;
  let idProduto: number;
  let idLocalizacao: number;

  before(async () => {
    servidor = await subir(createApp());
    admin = await tokenDe(await criarUsuarioTeste("administrador"));
    for (const nome of [`${prefixo}-a%b`, `${prefixo}-axb`, `${prefixo}_c`, `${prefixo}-c`, `${prefixo}-d\\e`]) {
      const p = await prisma.produto.create({ data: { nome, unidade_medida: "UN" } });
      idProduto = p.id_produto;
    }
    idLocalizacao = (await prisma.localizacao.create({ data: { corredor: prefixo, nivel: "1", posicao: "A" } }))
      .id_localizacao;
    for (const numero of [`${prefixo}-l%1`, `${prefixo}-lx1`, `${prefixo}_l2`, `${prefixo}-l2`]) {
      await prisma.lote.create({ data: { numero_lote: numero, id_produto: idProduto, id_localizacao: idLocalizacao } });
    }
  });

  after(async () => {
    await servidor.fechar();
    await prisma.produto.updateMany({ where: { nome: { startsWith: prefixo } }, data: { ativo: false } });
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  const buscar = async (caminho: string): Promise<Lista> => {
    const r = await chamarApi(servidor, "GET", caminho, admin);
    assert.equal(r.status, 200, caminho);
    return r.corpo as Lista;
  };

  it("literalParaLike escapa barra invertida, % e _", () => {
    assert.equal(literalParaLike("a%b_c\\d"), "a\\%b\\_c\\\\d");
  });

  it("produtos: % e _ só casam com o caractere literal", async () => {
    const percentual = await buscar(`/produtos?busca=${encodeURIComponent(`${prefixo}-a%b`)}`);
    assert.deepEqual(percentual.dados.map((p) => p.nome), [`${prefixo}-a%b`]);
    const sublinhado = await buscar(`/produtos?busca=${encodeURIComponent(`${prefixo}_c`)}`);
    assert.deepEqual(sublinhado.dados.map((p) => p.nome), [`${prefixo}_c`]);
    const barra = await buscar(`/produtos?busca=${encodeURIComponent(`${prefixo}-d\\e`)}`);
    assert.equal(barra.total, 1);
  });

  it("busca só com % ou _ não devolve tudo", async () => {
    const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM produto WHERE position('%' in nome) > 0 OR position('_' in categoria) > 0`;
    const lista = await buscar("/produtos?busca=%25&limite=100");
    assert.equal(BigInt(lista.total), n);
    const total = (await buscar("/produtos?limite=1")).total;
    assert.ok(lista.total < total);
  });

  it("lotes: número do lote com % e _ literais", async () => {
    const percentual = await buscar(`/lotes?numero_lote=${encodeURIComponent(`${prefixo}-l%1`)}`);
    assert.deepEqual(percentual.dados.map((l) => l.numero_lote), [`${prefixo}-l%1`]);
    const sublinhado = await buscar(`/lotes?numero_lote=${encodeURIComponent(`${prefixo}_l2`)}`);
    assert.deepEqual(sublinhado.dados.map((l) => l.numero_lote), [`${prefixo}_l2`]);
  });

  it("usuários e localizações com curingas literais", async () => {
    assert.equal((await buscar("/usuarios?busca=%25%25%25&limite=1")).total, 0);
    assert.equal((await buscar("/localizacoes?busca=%25%25%25&limite=1")).total, 0);
    assert.equal((await buscar(`/localizacoes?busca=${prefixo}`)).total, 1);
  });
});
