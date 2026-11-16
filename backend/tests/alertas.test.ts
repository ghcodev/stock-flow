import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { criarExportador, dependenciasDaExportacao, listarAlertasDeVencimento } from "../src/services/alertas.service.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";

type Pagina = { dados: { numero_lote: string }[]; pagina: number; limite: number; total: number };

describe("alertas de vencimento e exportação (A21, RF08, RN08)", () => {
  let servidor: Servidor;
  let c: Cenario;
  let escopo: { idsDeProduto: number[] };
  let numeroPerigoso: string;
  let nomePerigoso: string;

  const ajustarValidade = async (idLote: number, deslocamento: number | null): Promise<void> => {
    if (deslocamento === null) await prisma.$executeRaw`UPDATE lote SET data_validade = NULL WHERE id_lote = ${idLote}`;
    else await prisma.$executeRaw`UPDATE lote SET data_validade = current_date + ${deslocamento}::int WHERE id_lote = ${idLote}`;
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
    nomePerigoso = `=HYPERLINK("http://x";"${c.prefixo}")`;
    const produtoPerigoso = await prisma.produto.create({ data: { nome: nomePerigoso, unidade_medida: "UN" } });
    numeroPerigoso = `${c.prefixo};"p"\nq`;
    const perigoso = await chamarApi(servidor, "POST", "/lotes", c.operador, {
      numero_lote: numeroPerigoso,
      id_produto: produtoPerigoso.id_produto,
      id_localizacao: c.idLocalizacao,
      quantidade: "2",
    });
    assert.equal(perigoso.status, 201, perigoso.texto);
    await ajustarValidade((perigoso.corpo as { id_lote: number }).id_lote, 7);
    escopo = { idsDeProduto: [c.idProduto, produtoPerigoso.id_produto] };
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await prisma.produto.updateMany({ where: { nome: { contains: c.prefixo } }, data: { ativo: false } });
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("regra exata sobre os dados do próprio teste: só ativos entre hoje e hoje + 30, inclusive, em ordem de validade; sem validade, vencidos, bloqueados, ontem e +31 ficam fora; quantidade não filtra", async () => {
    const pagina = await listarAlertasDeVencimento({ limite: 100 }, escopo);
    assert.deepEqual(
      pagina.dados.map((a) => [a.numero_lote.replace(`${c.prefixo}-`, ""), a.dias_restantes]),
      [
        ["hoje", 0],
        [numeroPerigoso, 7],
        ["zerado", 10],
        ["d30", 30],
      ],
    );
    assert.equal(pagina.total, 4);
    const zerado = pagina.dados.find((a) => a.numero_lote.endsWith("-zerado"));
    assert.equal(zerado?.quantidade.toString(), "0");
    const hoje = pagina.dados[0];
    assert.equal(hoje?.quantidade.toString(), "3");
    assert.equal(hoje?.produto, `${c.prefixo}-prod`);
    assert.equal(hoje?.unidade_medida, "UN");
    assert.equal(hoje?.corredor, c.prefixo);
    assert.match(hoje?.data_validade ?? "", /^\d{4}-\d{2}-\d{2}$/);
  });

  it("paginação exata com escopo", async () => {
    const primeira = await listarAlertasDeVencimento({ limite: 3, pagina: 1 }, escopo);
    const segunda = await listarAlertasDeVencimento({ limite: 3, pagina: 2 }, escopo);
    assert.equal(primeira.dados.length, 3);
    assert.equal(segunda.dados.length, 1);
    assert.equal(primeira.total, 4);
    assert.equal(new Set([...primeira.dados, ...segunda.dados].map((a) => a.numero_lote)).size, 4);
  });

  it("CSV exato sobre os dados do próprio teste: BOM, cabeçalho, ponto e vírgula, CRLF, escapes e proteção contra fórmulas", async () => {
    const alertas = (await listarAlertasDeVencimento({ limite: 100 }, escopo)).dados;
    const csv = await criarExportador(dependenciasDaExportacao(escopo))();
    const data = (sufixo: string): string => alertas.find((a) => a.numero_lote === sufixo)?.data_validade ?? "?";
    const local = `${c.prefixo}-1-A`;
    const esperado =
      "\uFEFFNúmero do lote;Produto;Validade;Quantidade;Unidade;Localização\r\n" +
      `${c.prefixo}-hoje;${c.prefixo}-prod;${data(`${c.prefixo}-hoje`)};3;UN;${local}\r\n` +
      `"${c.prefixo};""p""\nq";"'=HYPERLINK(""http://x"";""${c.prefixo}"")";${data(numeroPerigoso)};2;UN;${local}\r\n` +
      `${c.prefixo}-zerado;${c.prefixo}-prod;${data(`${c.prefixo}-zerado`)};0;UN;${local}\r\n` +
      `${c.prefixo}-d30;${c.prefixo}-prod;${data(`${c.prefixo}-d30`)};3;UN;${local}\r\n`;
    assert.equal(csv, esperado);
    assert.equal(nomePerigoso.startsWith("="), true);
  });

  it("HTTP, só forma e permissão: operador e administrador listam; paginação inválida é 400; sem token 401", async () => {
    for (const token of [c.operador, c.admin]) {
      const r = await chamarApi(servidor, "GET", "/alertas/vencimento?limite=5", token);
      assert.equal(r.status, 200);
      const corpo = r.corpo as Pagina;
      assert.ok(Array.isArray(corpo.dados) && corpo.dados.length <= 5);
      assert.equal(corpo.limite, 5);
      assert.ok(Number.isInteger(corpo.total) && corpo.total >= 4);
    }
    for (const consulta of ["limite=101", "pagina=0", "limite=1&limite=2"]) {
      assert.equal((await chamarApi(servidor, "GET", `/alertas/vencimento?${consulta}`, c.operador)).status, 400, consulta);
    }
    assert.equal((await chamarApi(servidor, "GET", "/alertas/vencimento")).status, 401);
  });

  it("HTTP da exportação: operador 403, sem token 401; administrador recebe CSV com os cabeçalhos certos (ou o 422 do teto)", async () => {
    assert.equal((await chamarApi(servidor, "GET", "/alertas/vencimento/exportacao", c.operador)).status, 403);
    assert.equal((await chamarApi(servidor, "GET", "/alertas/vencimento/exportacao")).status, 401);
    const res = await fetch(`${servidor.url}/alertas/vencimento/exportacao`, { headers: { authorization: `Bearer ${c.admin}` } });
    if (res.status === 422) {
      assert.equal(((await res.json()) as { erro: { codigo: string } }).erro.codigo, "EXPORTACAO_MUITO_GRANDE");
      return;
    }
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /^text\/csv; charset=utf-8/i);
    assert.match(res.headers.get("content-disposition") ?? "", /^attachment; filename="alertas-vencimento\.csv"$/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  });

  it("não existem rotas de escrita em /alertas", async () => {
    for (const metodo of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal((await chamarApi(servidor, metodo, "/alertas/vencimento", c.admin, metodo === "DELETE" ? undefined : {})).status, 404);
    }
  });
});
