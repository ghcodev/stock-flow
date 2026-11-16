import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";

type Alerta = { numero_lote: string; data_validade: string; dias_restantes: number; quantidade: string; produto: string; unidade_medida: string; corredor: string; nivel: string; posicao: string };
type Pagina = { dados: Alerta[]; pagina: number; limite: number; total: number };

describe("alertas de vencimento e exportação (A21, RF08, RN08)", () => {
  let servidor: Servidor;
  let c: Cenario;
  let idPerigoso: number;

  const ajustarValidade = async (idLote: number, deslocamento: number | null): Promise<void> => {
    if (deslocamento === null) await prisma.$executeRaw`UPDATE lote SET data_validade = NULL WHERE id_lote = ${idLote}`;
    else await prisma.$executeRaw`UPDATE lote SET data_validade = current_date + ${deslocamento}::int WHERE id_lote = ${idLote}`;
  };
  const meusAlertas = async (token = c.operador): Promise<Alerta[]> => {
    const achados: Alerta[] = [];
    for (let pagina = 1; pagina <= 30; pagina++) {
      const r = await chamarApi(servidor, "GET", `/alertas/vencimento?limite=100&pagina=${pagina}`, token);
      assert.equal(r.status, 200);
      const corpo = r.corpo as Pagina;
      achados.push(...corpo.dados.filter((a) => a.numero_lote.includes(c.prefixo)));
      if (corpo.dados.length < 100) break;
    }
    return achados;
  };

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "AL");
    const casos: [string, number | null, string][] = [
      ["hoje", 0, "ativo"],
      ["d30", 30, "ativo"],
      ["d31", 31, "ativo"],
      ["ontem", -1, "ativo"],
      ["semvalidade", null, "ativo"],
      ["bloqueado", 5, "bloqueado"],
      ["vencido", 5, "vencido"],
      ["zerado", 10, "ativo"],
    ];
    for (const [sufixo, deslocamento, status] of casos) {
      const id = await c.novoLote(sufixo, { quantidade: sufixo === "zerado" ? "0" : "3" });
      await ajustarValidade(id, deslocamento);
      if (status !== "ativo") await prisma.lote.update({ where: { id_lote: id }, data: { status_lote: status as "bloqueado" | "vencido" } });
    }
    const produtoPerigoso = await prisma.produto.create({
      data: { nome: `=HYPERLINK("http://x";"${c.prefixo}")`, unidade_medida: "UN" },
    });
    const perigoso = await chamarApi(servidor, "POST", "/lotes", c.operador, {
      numero_lote: `${c.prefixo};"p"\nq`,
      id_produto: produtoPerigoso.id_produto,
      id_localizacao: c.idLocalizacao,
      quantidade: "2",
    });
    assert.equal(perigoso.status, 201, perigoso.texto);
    idPerigoso = (perigoso.corpo as { id_lote: number }).id_lote;
    await ajustarValidade(idPerigoso, 7);
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await prisma.produto.updateMany({ where: { nome: { contains: c.prefixo } }, data: { ativo: false } });
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("só lotes ativos com validade entre hoje e hoje + 30 dias, inclusive; sem validade, vencidos, bloqueados e passados ficam fora; quantidade não filtra", async () => {
    const alertas = await meusAlertas();
    const nomes = alertas.map((a) => a.numero_lote.replace(`${c.prefixo}-`, "")).sort();
    assert.deepEqual(nomes.filter((n) => !n.startsWith(c.prefixo)), ["d30", "hoje", "zerado"]);
    const hoje = alertas.find((a) => a.numero_lote.endsWith("-hoje"));
    const d30 = alertas.find((a) => a.numero_lote.endsWith("-d30"));
    assert.equal(hoje?.dias_restantes, 0);
    assert.equal(d30?.dias_restantes, 30);
    assert.equal(alertas.find((a) => a.numero_lote.endsWith("-zerado"))?.quantidade, "0");
    assert.equal(hoje?.quantidade, "3");
    assert.equal(hoje?.produto, `${c.prefixo}-prod`);
    assert.equal(hoje?.unidade_medida, "UN");
    assert.equal(hoje?.corredor, c.prefixo);
    assert.match(hoje?.data_validade ?? "", /^\d{4}-\d{2}-\d{2}$/);
  });

  it("operador e administrador consultam; ordem por validade; paginação e validação", async () => {
    const doAdmin = await meusAlertas(c.admin);
    assert.ok(doAdmin.length >= 3);
    const ordenados = [...doAdmin].sort((a, b) => a.data_validade.localeCompare(b.data_validade));
    assert.deepEqual(doAdmin.map((a) => a.data_validade), ordenados.map((a) => a.data_validade));
    const pagina = (await chamarApi(servidor, "GET", "/alertas/vencimento?limite=1&pagina=1", c.operador)).corpo as Pagina;
    assert.equal(pagina.dados.length, 1);
    assert.ok(pagina.total >= 3);
    for (const consulta of ["limite=101", "pagina=0", "limite=1&limite=2"]) {
      assert.equal((await chamarApi(servidor, "GET", `/alertas/vencimento?${consulta}`, c.operador)).status, 400, consulta);
    }
    assert.equal((await chamarApi(servidor, "GET", "/alertas/vencimento")).status, 401);
  });

  it("exportação: só administrador (operador 403, sem token 401)", async () => {
    assert.equal((await chamarApi(servidor, "GET", "/alertas/vencimento/exportacao", c.operador)).status, 403);
    assert.equal((await chamarApi(servidor, "GET", "/alertas/vencimento/exportacao")).status, 401);
  });

  it("exportação em CSV: cabeçalhos HTTP, BOM, ponto e vírgula, CRLF, colunas e linhas do próprio teste", async () => {
    const res = await fetch(`${servidor.url}/alertas/vencimento/exportacao`, { headers: { authorization: `Bearer ${c.admin}` } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /^text\/csv; charset=utf-8/i);
    assert.match(res.headers.get("content-disposition") ?? "", /^attachment; filename="alertas-vencimento\.csv"$/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    const texto = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    assert.ok(texto.startsWith("﻿Número do lote;Produto;Validade;Quantidade;Unidade;Localização\r\n"));
    assert.ok(texto.endsWith("\r\n"));
    const linhaHoje = texto.split("\r\n").find((linha) => linha.startsWith(`${c.prefixo}-hoje;`));
    assert.ok(linhaHoje);
    const colunas = linhaHoje.split(";");
    assert.equal(colunas.length, 6);
    assert.equal(colunas[1], `${c.prefixo}-prod`);
    assert.match(colunas[2] ?? "", /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(colunas[3], "3");
    assert.equal(colunas[4], "UN");
    assert.equal(colunas[5], `${c.prefixo}-1-A`);
    assert.equal(texto.includes(`${c.prefixo}-d31`), false);
    assert.equal(texto.includes(`${c.prefixo}-bloqueado`), false);
    assert.equal(texto.includes(`${c.prefixo}-semvalidade`), false);
  });

  it("exportação escapa aspas, ponto e vírgula e quebra de linha e protege contra fórmulas", async () => {
    const res = await fetch(`${servidor.url}/alertas/vencimento/exportacao`, { headers: { authorization: `Bearer ${c.admin}` } });
    const texto = await res.text();
    const numeroEscapado = `"${c.prefixo};""p""\nq"`;
    const produtoEscapado = `"'=HYPERLINK(""http://x"";""${c.prefixo}"")"`;
    assert.ok(texto.includes(`${numeroEscapado};${produtoEscapado};`), "linha do lote com conteúdo perigoso não encontrada");
  });

  it("não existem rotas de escrita em /alertas", async () => {
    for (const metodo of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal((await chamarApi(servidor, metodo, "/alertas/vencimento", c.admin, metodo === "DELETE" ? undefined : {})).status, 404);
    }
  });
});
