import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import {
  criarUsuarioTeste,
  desativarUsuariosTeste,
  subir,
  tokenDe,
  type Servidor,
  type UsuarioTeste,
} from "./helpers.ts";

type Lote = {
  id_lote: number;
  numero_lote: string;
  data_fabricacao: string | null;
  data_validade: string | null;
  quantidade: string;
  status_lote: string;
  data_bloqueio: string | null;
  motivo_bloqueio: string | null;
  id_produto: number;
  id_localizacao: number;
  produto: { nome: string; unidade_medida: string };
  localizacao: { corredor: string };
  identificacao: { tipo_identificacao: string; codigo: string } | null;
};
type Lista = { dados: Lote[]; pagina: number; limite: number; total: number };

describe("lotes (A7)", () => {
  const prefixo = `L${randomUUID().slice(0, 8)}`;
  let servidor: Servidor;
  let operadorUsuario: UsuarioTeste;
  let operador: string;
  let admin: string;
  let idProduto: number;
  let idProdutoInativo: number;
  let idLocalizacao: number;
  let idOutraLocalizacao: number;

  const numero = (sufixo: string): string => `${prefixo}-${sufixo}`;
  const criar = (corpo: Record<string, unknown>, token = operador) =>
    chamarApi(servidor, "POST", "/lotes", token, {
      id_produto: idProduto,
      id_localizacao: idLocalizacao,
      ...corpo,
    });
  const auditoria = (idLote: number) =>
    prisma.$queryRaw<{ id_usuario: number | null; operacao: string }[]>`
      SELECT id_usuario, operacao::text AS operacao FROM auditoria_log
      WHERE tabela_afetada = 'lote' AND (valor_novo->>'id_lote')::int = ${idLote} ORDER BY id_log`;

  before(async () => {
    servidor = await subir(createApp());
    operadorUsuario = await criarUsuarioTeste("operador");
    operador = await tokenDe(operadorUsuario);
    admin = await tokenDe(await criarUsuarioTeste("administrador"));
    const produto = await prisma.produto.create({ data: { nome: `${prefixo}-prod`, unidade_medida: "KG" } });
    const inativo = await prisma.produto.create({ data: { nome: `${prefixo}-inativo`, unidade_medida: "UN", ativo: false } });
    const loc = await prisma.localizacao.create({ data: { corredor: prefixo, nivel: "1", posicao: "A" } });
    const outra = await prisma.localizacao.create({ data: { corredor: prefixo, nivel: "1", posicao: "B" } });
    idProduto = produto.id_produto;
    idProdutoInativo = inativo.id_produto;
    idLocalizacao = loc.id_localizacao;
    idOutraLocalizacao = outra.id_localizacao;
  });

  after(async () => {
    await servidor.fechar();
    await prisma.produto.updateMany({ where: { nome: { startsWith: prefixo } }, data: { ativo: false } });
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("cria lote com etiqueta: saldo inicial, datas em texto, vínculos e uma única entrada inicial", async () => {
    const r = await criar({
      numero_lote: numero("a"),
      quantidade: 10.5,
      data_fabricacao: "2026-01-10",
      data_validade: "2027-01-10",
      etiqueta: { tipo: "qr_code", codigo: `QR-${prefixo}-a` },
    });
    assert.equal(r.status, 201);
    const lote = r.corpo as Lote;
    assert.equal(lote.quantidade, "10.5");
    assert.equal(lote.data_fabricacao, "2026-01-10");
    assert.equal(lote.data_validade, "2027-01-10");
    assert.equal(lote.status_lote, "ativo");
    assert.equal(lote.produto.nome, `${prefixo}-prod`);
    assert.equal(lote.localizacao.corredor, prefixo);
    assert.deepEqual(
      { t: lote.identificacao?.tipo_identificacao, c: lote.identificacao?.codigo },
      { t: "qr_code", c: `QR-${prefixo}-a` },
    );
    assert.equal(await prisma.movimentacao.count({ where: { id_lote: lote.id_lote } }), 1);
    const linhas = await auditoria(lote.id_lote);
    assert.equal(linhas.length, 1);
    assert.equal(linhas[0]?.operacao, "INSERT");
    assert.equal(linhas[0]?.id_usuario, operadorUsuario.id);
  });

  it("sem etiqueta e sem quantidade: saldo 0, identificacao nula", async () => {
    const lote = (await criar({ numero_lote: numero("b") }, admin)).corpo as Lote;
    assert.equal(lote.quantidade, "0");
    assert.equal(lote.identificacao, null);
    assert.equal(lote.data_validade, null);
  });

  it("RN02: produto inexistente ou inativo e RN06: localização inexistente são 422", async () => {
    const semProduto = await criar({ numero_lote: numero("c1"), id_produto: 2_000_000_000 });
    assert.equal(semProduto.status, 422);
    assert.equal((semProduto.corpo as { erro: { codigo: string } }).erro.codigo, "PRODUTO_INVALIDO");
    const inativo = await criar({ numero_lote: numero("c2"), id_produto: idProdutoInativo });
    assert.equal(inativo.status, 422);
    assert.equal((inativo.corpo as { erro: { codigo: string } }).erro.codigo, "PRODUTO_INATIVO");
    const semLocal = await criar({ numero_lote: numero("c3"), id_localizacao: 2_000_000_000 });
    assert.equal(semLocal.status, 422);
    assert.equal((semLocal.corpo as { erro: { codigo: string } }).erro.codigo, "LOCALIZACAO_INVALIDA");
    assert.equal(await prisma.lote.count({ where: { numero_lote: { startsWith: numero("c") } } }), 0);
  });

  it("RN03: número de lote e código de etiqueta duplicados são 409 e a transação desfaz tudo", async () => {
    assert.equal((await criar({ numero_lote: numero("d1") })).status, 201);
    const dupLote = await criar({ numero_lote: numero("d1") });
    assert.equal(dupLote.status, 409);
    assert.doesNotMatch(dupLote.texto, /lote_|unique|duplicate/i);
    const codigo = `QR-${prefixo}-d`;
    assert.equal((await criar({ numero_lote: numero("d2"), etiqueta: { tipo: "rfid", codigo } })).status, 201);
    const dupEtiqueta = await criar({ numero_lote: numero("d3"), etiqueta: { tipo: "rfid", codigo } });
    assert.equal(dupEtiqueta.status, 409);
    assert.equal(await prisma.lote.count({ where: { numero_lote: numero("d3") } }), 0);
  });

  it("validação: datas, quantidade, etiqueta e identificadores", async () => {
    const casos: Record<string, unknown>[] = [
      { numero_lote: numero("v1"), data_fabricacao: "2026-05-10", data_validade: "2026-05-09" },
      { numero_lote: numero("v2"), data_validade: "10/05/2026" },
      { numero_lote: numero("v3"), data_validade: "2026-02-31" },
      { numero_lote: numero("v4"), quantidade: -1 },
      { numero_lote: numero("v5"), quantidade: "abc" },
      { numero_lote: numero("v6"), etiqueta: { tipo: "barras", codigo: "X" } },
      { numero_lote: numero("v7"), etiqueta: { tipo: "qr_code" } },
      { numero_lote: numero("v8"), etiqueta: "texto" },
      { numero_lote: "" },
      { numero_lote: numero("v9"), id_produto: "um" },
      { numero_lote: numero("v10"), id_localizacao: 0 },
    ];
    for (const caso of casos) {
      const r = await criar(caso);
      assert.equal(r.status, 400, JSON.stringify(caso));
      assert.equal((r.corpo as { erro: { codigo: string } }).erro.codigo, "VALIDACAO");
    }
    assert.equal((await criar({})).status, 400);
  });

  it("campos desconhecidos são ignorados: status e id não são aceitos na criação", async () => {
    const lote = (await criar({ numero_lote: numero("e1"), status_lote: "bloqueado", id_lote: 1, motivo_bloqueio: "x" }))
      .corpo as Lote;
    assert.equal(lote.status_lote, "ativo");
    assert.notEqual(lote.id_lote, 1);
    assert.equal(lote.motivo_bloqueio, null);
  });

  it("consulta por produto, código do lote e localização, com paginação", async () => {
    const outraLoc = (await criar({ numero_lote: numero("f1"), id_localizacao: idOutraLocalizacao })).corpo as Lote;
    const porProduto = (await chamarApi(servidor, "GET", `/lotes?id_produto=${idProduto}&limite=3&pagina=1`, operador))
      .corpo as Lista;
    assert.ok(porProduto.total >= 5);
    assert.equal(porProduto.dados.length, 3);
    assert.ok(porProduto.dados.every((l) => l.id_produto === idProduto));
    const porCodigo = (await chamarApi(servidor, "GET", `/lotes?numero_lote=${prefixo.toLowerCase()}-f`, operador))
      .corpo as Lista;
    assert.equal(porCodigo.total, 1);
    assert.equal(porCodigo.dados[0]?.id_lote, outraLoc.id_lote);
    const porLocal = (await chamarApi(servidor, "GET", `/lotes?id_localizacao=${idOutraLocalizacao}`, admin)).corpo as Lista;
    assert.equal(porLocal.total, 1);
    const porStatus = (await chamarApi(servidor, "GET", `/lotes?id_produto=${idProduto}&status=bloqueado`, admin)).corpo as Lista;
    assert.equal(porStatus.total, 0);
    for (const consulta of ["status=cancelado", "id_produto=x", "limite=101", "id_localizacao=0"]) {
      assert.equal((await chamarApi(servidor, "GET", `/lotes?${consulta}`, operador)).status, 400, consulta);
    }
  });

  it("obter por id, 404 e 400", async () => {
    const lote = (await criar({ numero_lote: numero("g1") })).corpo as Lote;
    const r = await chamarApi(servidor, "GET", `/lotes/${lote.id_lote}`, admin);
    assert.equal(r.status, 200);
    assert.equal((r.corpo as Lote).numero_lote, numero("g1"));
    assert.equal((await chamarApi(servidor, "GET", "/lotes/2000000000", admin)).status, 404);
    assert.equal((await chamarApi(servidor, "GET", "/lotes/abc", admin)).status, 400);
  });

  it("bloquear e desbloquear: troca o status sem alterar o saldo, com auditoria do usuário", async () => {
    const lote = (await criar({ numero_lote: numero("h1"), quantidade: 7 })).corpo as Lote;
    const bloqueado = await chamarApi(servidor, "POST", `/lotes/${lote.id_lote}/bloquear`, operador, {
      motivo: "Avaria na embalagem",
    });
    assert.equal(bloqueado.status, 200);
    const b = bloqueado.corpo as Lote;
    assert.equal(b.status_lote, "bloqueado");
    assert.equal(b.motivo_bloqueio, "Avaria na embalagem");
    assert.ok(b.data_bloqueio);
    assert.equal(b.quantidade, "7");
    const repetido = await chamarApi(servidor, "POST", `/lotes/${lote.id_lote}/bloquear`, operador, { motivo: "de novo" });
    assert.equal(repetido.status, 409);
    const livre = await chamarApi(servidor, "POST", `/lotes/${lote.id_lote}/desbloquear`, admin);
    assert.equal(livre.status, 200);
    const l = livre.corpo as Lote;
    assert.equal(l.status_lote, "ativo");
    assert.equal(l.motivo_bloqueio, null);
    assert.equal(l.data_bloqueio, null);
    assert.equal(l.quantidade, "7");
    assert.equal((await chamarApi(servidor, "POST", `/lotes/${lote.id_lote}/desbloquear`, admin)).status, 409);
    const linhas = await auditoria(lote.id_lote);
    assert.deepEqual(linhas.map((x) => x.operacao), ["INSERT", "UPDATE", "UPDATE"]);
    assert.deepEqual(linhas.map((x) => x.id_usuario), [operadorUsuario.id, operadorUsuario.id, linhas[2]?.id_usuario]);
    assert.notEqual(linhas[2]?.id_usuario, operadorUsuario.id);
    assert.equal(await prisma.movimentacao.count({ where: { id_lote: lote.id_lote } }), 1);
  });

  it("bloquear exige motivo, 404 para inexistente; lote vencido não é bloqueado e volta vencido ao desbloquear", async () => {
    const lote = (await criar({ numero_lote: numero("i1"), data_validade: "2000-01-01" })).corpo as Lote;
    assert.equal((await chamarApi(servidor, "POST", `/lotes/${lote.id_lote}/bloquear`, operador, {})).status, 400);
    assert.equal((await chamarApi(servidor, "POST", "/lotes/2000000000/bloquear", operador, { motivo: "x" })).status, 404);
    assert.equal((await chamarApi(servidor, "POST", "/lotes/2000000000/desbloquear", operador)).status, 404);
    await chamarApi(servidor, "POST", `/lotes/${lote.id_lote}/bloquear`, operador, { motivo: "Validade" });
    const desbloqueado = await chamarApi(servidor, "POST", `/lotes/${lote.id_lote}/desbloquear`, operador);
    assert.equal((desbloqueado.corpo as Lote).status_lote, "vencido");
    const vencido = await chamarApi(servidor, "POST", `/lotes/${lote.id_lote}/bloquear`, operador, { motivo: "x" });
    assert.equal(vencido.status, 409);
  });

  it("sem token 401; sem rota de exclusão nem de alteração de saldo", async () => {
    assert.equal((await chamarApi(servidor, "GET", "/lotes")).status, 401);
    assert.equal((await chamarApi(servidor, "POST", "/lotes", undefined, {})).status, 401);
    const lote = (await criar({ numero_lote: numero("j1"), quantidade: 3 })).corpo as Lote;
    assert.equal((await chamarApi(servidor, "DELETE", `/lotes/${lote.id_lote}`, admin)).status, 404);
    assert.equal((await chamarApi(servidor, "PATCH", `/lotes/${lote.id_lote}`, admin, { quantidade: 99 })).status, 404);
    assert.equal((await chamarApi(servidor, "PUT", `/lotes/${lote.id_lote}`, admin, { quantidade: 99 })).status, 404);
    const depois = (await chamarApi(servidor, "GET", `/lotes/${lote.id_lote}`, admin)).corpo as Lote;
    assert.equal(depois.quantidade, "3");
  });

  it("V2: leituras trazem validade_expirada calculada no banco; POSTs não mudam", async () => {
    const ontem = await criar({ numero_lote: numero("v2a"), data_fabricacao: "2024-01-01", data_validade: "2024-06-30" });
    assert.equal(ontem.status, 201);
    assert.equal((ontem.corpo as Record<string, unknown>)["validade_expirada"], undefined);
    const futuro = (await criar({ numero_lote: numero("v2b"), data_validade: "2099-12-31" })).corpo as Lote;
    const sem = (await criar({ numero_lote: numero("v2c") })).corpo as Lote;
    const idPassado = (ontem.corpo as Lote).id_lote;
    const campo = async (id: number) =>
      ((await chamarApi(servidor, "GET", `/lotes/${id}`, operador)).corpo as Lote & { validade_expirada: boolean }).validade_expirada;
    assert.equal(await campo(idPassado), true);
    assert.equal(await campo(futuro.id_lote), false);
    assert.equal(await campo(sem.id_lote), false);
    const hoje = (await prisma.$queryRaw<{ d: string }[]>`SELECT to_char(hoje_operacional(), 'YYYY-MM-DD') AS d`)[0]?.d ?? "";
    const limite = (await criar({ numero_lote: numero("v2d"), data_validade: hoje })).corpo as Lote;
    assert.equal(await campo(limite.id_lote), false);
    const lista = (await chamarApi(servidor, "GET", `/lotes?numero_lote=${prefixo.toLowerCase()}-v2`, operador)).corpo as unknown as { dados: { validade_expirada: boolean; numero_lote: string }[] };
    assert.equal(lista.dados.length, 4);
    for (const lote of lista.dados) assert.equal(typeof lote.validade_expirada, "boolean");
    assert.equal(lista.dados.find((l) => l.numero_lote === numero("v2a"))?.validade_expirada, true);
    assert.equal(lista.dados.filter((l) => l.validade_expirada).length, 1);
    const porEtiqueta = await criar({ numero_lote: numero("v2e"), data_validade: "2099-01-01", etiqueta: { tipo: "qr_code", codigo: `QR-${prefixo}-v2` } });
    assert.equal(porEtiqueta.status, 201);
    const achado = (await chamarApi(servidor, "GET", `/lotes?codigo_etiqueta=${encodeURIComponent(`QR-${prefixo}-v2`)}`, operador)).corpo as unknown as { dados: { validade_expirada: boolean }[] };
    assert.equal(achado.dados[0]?.validade_expirada, false);
  });
});
