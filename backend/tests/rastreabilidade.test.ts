import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";

type Posicao = { id_localizacao: number; corredor: string; nivel: string; posicao: string };
type Evento = {
  id_movimentacao: string;
  data_movimentacao: string;
  tipo_movimentacao: string;
  status_movimentacao: string;
  quantidade: string;
  saldo_anterior: string;
  saldo_posterior: string;
  usuario: { id_usuario: number; nome: string };
  origem: Posicao | null;
  destino: Posicao | null;
  motivo_movimentacao: string | null;
};
type Resposta = {
  pagina: number;
  limite: number;
  total: number;
  proximo_depois_de_id: string | null;
  lote: { id_lote: number; numero_lote: string; quantidade: string; id_localizacao: number; produto: { nome: string }; localizacao: Posicao; identificacao: { codigo: string } | null };
  linha_do_tempo: Evento[];
};

describe("rastreabilidade do lote (A19, RF14, RN18)", () => {
  let servidor: Servidor;
  let c: Cenario;
  let lote: number;

  const rastrear = (consulta: string, token = c.operador) => chamarApi(servidor, "GET", `/rastreabilidade?${consulta}`, token);
  const post = (caminho: string, corpo: unknown, token = c.operador) => chamarApi(servidor, "POST", caminho, token, corpo);

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "RA");
    lote = await c.novoLote("a", { quantidade: "20", etiqueta: { tipo: "qr_code", codigo: `QR-${c.prefixo}` } });
    assert.equal((await post("/movimentacoes/entrada", { id_lote: lote, quantidade: 5 })).status, 201);
    assert.equal((await post("/movimentacoes/saida", { id_lote: lote, quantidade: 3 }, c.admin)).status, 201);
    assert.equal(
      (await post("/movimentacoes/transferencia", { id_lote: lote, id_localizacao_destino: c.idOutraLocalizacao, motivo: "mover" })).status,
      201,
    );
    const contagem = (await post("/inventario/contagens", { id_lote: lote, quantidade_contada: 21 })).corpo as Evento;
    assert.equal((await post(`/inventario/contagens/${contagem.id_movimentacao}/finalizar`, {}, c.admin)).status, 200);
    const cancelada = (await post("/inventario/contagens", { id_lote: lote, quantidade_contada: 1 })).corpo as Evento;
    assert.equal((await post(`/inventario/contagens/${cancelada.id_movimentacao}/cancelar`, {}, c.admin)).status, 200);
    const pendente = await post("/inventario/contagens", { id_lote: lote, quantidade_contada: 22 });
    assert.equal(pendente.status, 201);
    assert.equal(
      (await post("/movimentacoes/ajuste", { id_lote: lote, saldo_exibido: 21, novo_saldo: 30, motivo: "Correção de teste automatizado" }, c.admin)).status,
      201,
    );
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("por número do lote: lote, produto, localização atual, etiqueta e a linha do tempo completa em ordem cronológica", async () => {
    const r = await rastrear(`numero_lote=${encodeURIComponent(`${c.prefixo}-a`)}`);
    assert.equal(r.status, 200);
    const corpo = r.corpo as Resposta;
    assert.equal(corpo.lote.id_lote, lote);
    assert.equal(corpo.lote.produto.nome, `${c.prefixo}-prod`);
    assert.equal(corpo.lote.localizacao.id_localizacao, c.idOutraLocalizacao);
    assert.equal(corpo.lote.identificacao?.codigo, `QR-${c.prefixo}`);
    assert.equal(corpo.lote.quantidade, "30");
    assert.deepEqual(
      corpo.linha_do_tempo.map((e) => `${e.tipo_movimentacao}:${e.status_movimentacao}`),
      [
        "entrada:concluida",
        "entrada:concluida",
        "saida:concluida",
        "transferencia:concluida",
        "inventario:concluida",
        "ajuste:concluida",
        "inventario:cancelada",
        "inventario:pendente",
        "ajuste:concluida",
      ],
    );
    for (let i = 1; i < corpo.linha_do_tempo.length; i++) {
      const anterior = corpo.linha_do_tempo[i - 1];
      const atual = corpo.linha_do_tempo[i];
      assert.ok(anterior && atual);
      const ordenado =
        anterior.data_movimentacao < atual.data_movimentacao ||
        (anterior.data_movimentacao === atual.data_movimentacao && BigInt(anterior.id_movimentacao) < BigInt(atual.id_movimentacao));
      assert.ok(ordenado, `fora de ordem na posição ${i}`);
    }
  });

  it("cada evento traz data, usuário, saldos, origem e destino, com BIGINT e NUMERIC em texto", async () => {
    const r = await rastrear(`id_lote=${lote}`, c.admin);
    const corpo = r.corpo as Resposta;
    assert.match(r.texto, /"id_movimentacao":"\d+"/);
    const [inicial, entrada, saida, transferencia] = corpo.linha_do_tempo;
    assert.equal(inicial?.saldo_anterior, "0");
    assert.equal(inicial?.saldo_posterior, "20");
    assert.equal(inicial?.destino?.id_localizacao, c.idLocalizacao);
    assert.equal(entrada?.usuario.id_usuario, c.operadorUsuario.id);
    assert.equal(entrada?.saldo_anterior, "20");
    assert.equal(entrada?.saldo_posterior, "25");
    assert.equal(saida?.usuario.id_usuario, c.adminUsuario.id);
    assert.equal(saida?.origem?.id_localizacao, c.idLocalizacao);
    assert.equal(saida?.destino, null);
    assert.equal(transferencia?.origem?.id_localizacao, c.idLocalizacao);
    assert.equal(transferencia?.destino?.id_localizacao, c.idOutraLocalizacao);
    assert.equal(typeof transferencia?.data_movimentacao, "string");
    assert.equal(typeof corpo.linha_do_tempo[0]?.usuario.nome, "string");
  });

  it("os dois perfis consultam; busca por número é exata (prefixo não casa)", async () => {
    assert.equal((await rastrear(`id_lote=${lote}`, c.operador)).status, 200);
    assert.equal((await rastrear(`id_lote=${lote}`, c.admin)).status, 200);
    assert.equal((await rastrear(`numero_lote=${encodeURIComponent(c.prefixo)}`)).status, 404);
    assert.equal((await rastrear(`numero_lote=${encodeURIComponent(`${c.prefixo}-A`)}`)).status, 404);
  });

  it("lote existente sem movimentações: 200 com linha do tempo vazia; lote inexistente: 404", async () => {
    const vazio = await c.novoLote("b");
    const r = await rastrear(`id_lote=${vazio}`);
    assert.equal(r.status, 200);
    assert.deepEqual((r.corpo as Resposta).linha_do_tempo, []);
    assert.equal((r.corpo as Resposta).lote.id_lote, vazio);
    assert.equal((await rastrear("id_lote=2000000000")).status, 404);
    assert.equal((await rastrear("numero_lote=nao-existe-nunca")).status, 404);
  });

  it("validação e token: exatamente um critério, sem arrays, NUL ou repetição; sem token 401", async () => {
    for (const consulta of [
      "",
      `id_lote=${lote}&numero_lote=x`,
      "id_lote=0",
      "id_lote=abc",
      `id_lote=${lote}&id_lote=${lote}`,
      "numero_lote=",
      "numero_lote=a&numero_lote=b",
      "numero_lote=%00",
      `numero_lote=${"x".repeat(51)}`,
      `id_lote=${lote}&limite=101`,
      `id_lote=${lote}&pagina=0`,
      `id_lote=${lote}&limite=1&limite=2`,
      `id_lote=${lote}&depois_de_id=0`,
      `id_lote=${lote}&depois_de_id=abc`,
      `id_lote=${lote}&depois_de_id=1&depois_de_id=2`,
      `id_lote=${lote}&depois_de_id=1&pagina=2`,
    ]) {
      assert.equal((await rastrear(consulta)).status, 400, consulta);
    }
    assert.equal((await chamarApi(servidor, "GET", `/rastreabilidade?id_lote=${lote}`)).status, 401);
    for (const metodo of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal((await chamarApi(servidor, metodo, "/rastreabilidade", c.admin, metodo === "DELETE" ? undefined : {})).status, 404);
    }
  });

  it("G1a: linha do tempo paginada por pagina e por cursor, em ordem cronológica, com os dados do lote em toda página", async () => {
    const todos = (await rastrear(`id_lote=${lote}&limite=100`)).corpo as Resposta;
    assert.equal(todos.total, 9);
    assert.equal(todos.linha_do_tempo.length, 9);
    assert.equal(todos.proximo_depois_de_id, null);
    const ids = todos.linha_do_tempo.map((e) => e.id_movimentacao);

    const porPagina: string[] = [];
    for (let pagina = 1; pagina <= 3; pagina++) {
      const corpo = (await rastrear(`id_lote=${lote}&limite=4&pagina=${pagina}`)).corpo as Resposta;
      assert.equal(corpo.lote.id_lote, lote);
      assert.equal(corpo.total, 9);
      assert.equal(corpo.pagina, pagina);
      assert.equal(corpo.limite, 4);
      porPagina.push(...corpo.linha_do_tempo.map((e) => e.id_movimentacao));
    }
    assert.deepEqual(porPagina, ids);

    const porCursor: string[] = [];
    let cursor: string | null = null;
    let voltas = 0;
    do {
      const consulta: string = `id_lote=${lote}&limite=4${cursor === null ? "" : `&depois_de_id=${cursor}`}`;
      const corpo = (await rastrear(consulta)).corpo as Resposta;
      assert.equal(corpo.lote.numero_lote, `${c.prefixo}-a`);
      porCursor.push(...corpo.linha_do_tempo.map((e) => e.id_movimentacao));
      cursor = corpo.proximo_depois_de_id;
      voltas += 1;
    } while (cursor !== null && voltas < 10);
    assert.deepEqual(porCursor, ids);
    assert.equal(voltas, 3);
  });

  it("G1a: limite padrão 50 e máximo 100; cursor de outro lote é recusado; grava durante a leitura sem repetir nem pular", async () => {
    const grande = await c.novoLote("grande", { quantidade: "1" });
    for (let i = 0; i < 54; i++) {
      assert.equal((await post("/movimentacoes/entrada", { id_lote: grande, quantidade: 1 })).status, 201);
    }
    const primeira = (await rastrear(`id_lote=${grande}`)).corpo as Resposta;
    assert.equal(primeira.limite, 50);
    assert.equal(primeira.linha_do_tempo.length, 50);
    assert.equal(primeira.total, 55);
    assert.ok(primeira.proximo_depois_de_id);
    assert.equal((await post("/movimentacoes/entrada", { id_lote: grande, quantidade: 1 })).status, 201);
    const segunda = (await rastrear(`id_lote=${grande}&depois_de_id=${primeira.proximo_depois_de_id}`)).corpo as Resposta;
    assert.equal(segunda.linha_do_tempo.length, 6);
    assert.equal(segunda.proximo_depois_de_id, null);
    const ids = [...primeira.linha_do_tempo, ...segunda.linha_do_tempo].map((e) => e.id_movimentacao);
    assert.equal(new Set(ids).size, 56);
    const doOutroLote = primeira.linha_do_tempo[0]?.id_movimentacao ?? "0";
    assert.equal((await rastrear(`id_lote=${lote}&depois_de_id=${doOutroLote}`)).status, 400);
    assert.equal((await rastrear(`id_lote=${grande}&limite=100`)).status, 200);
  });
});
