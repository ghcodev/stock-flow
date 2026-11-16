import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";

type LoteMapa = { id_lote: number; numero_lote: string; status_lote: string; quantidade: string; unidade_medida: string; produto: string };
type Posicao = { total_lotes: number; id_localizacao: number; corredor: string; nivel: string; posicao: string; capacidade: string | null; descricao: string | null; lotes: LoteMapa[] };
type Pagina = { dados: Posicao[]; pagina: number; limite: number; total: number };

describe("mapa do armazém (A22, RF12)", () => {
  const corredor = `M${randomUUID().slice(0, 8)}`;
  let servidor: Servidor;
  let c: Cenario;
  let posicaoCheia: number;
  let posicaoVazia: number;

  const mapa = async (consulta: string, token = c.operador): Promise<Pagina> => {
    const r = await chamarApi(servidor, "GET", `/mapa?${consulta}`, token);
    assert.equal(r.status, 200, r.texto);
    return r.corpo as Pagina;
  };

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "MP");
    posicaoCheia = (await prisma.localizacao.create({ data: { corredor, nivel: "1", posicao: "A", capacidade: "250.5", descricao: "cheia" } })).id_localizacao;
    posicaoVazia = (await prisma.localizacao.create({ data: { corredor, nivel: "1", posicao: "B" } })).id_localizacao;
    await prisma.localizacao.create({ data: { corredor, nivel: "2", posicao: "A" } });
    const criar = async (sufixo: string, quantidade: string): Promise<number> => {
      const r = await chamarApi(servidor, "POST", "/lotes", c.operador, {
        numero_lote: `${c.prefixo}-${sufixo}`,
        id_produto: c.idProduto,
        id_localizacao: posicaoCheia,
        quantidade,
      });
      assert.equal(r.status, 201);
      return (r.corpo as { id_lote: number }).id_lote;
    };
    await criar("a", "10");
    const bloqueado = await criar("b", "4.5");
    await chamarApi(servidor, "POST", `/lotes/${bloqueado}/bloquear`, c.operador, { motivo: "mapa" });
    await criar("zerado", "0");
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("localizações em ordem com capacidade como no banco, vários lotes por posição, unidade e quantidade em texto", async () => {
    const pagina = await mapa(`corredor=${corredor}`);
    assert.equal(pagina.total, 3);
    assert.deepEqual(pagina.dados.map((p) => `${p.nivel}${p.posicao}`), ["1A", "1B", "2A"]);
    const cheia = pagina.dados[0];
    assert.equal(cheia?.id_localizacao, posicaoCheia);
    assert.equal(cheia?.capacidade, "250.5");
    assert.equal(cheia?.descricao, "cheia");
    assert.equal(cheia?.total_lotes, 2);
    assert.deepEqual(cheia?.lotes.map((l) => l.numero_lote), [`${c.prefixo}-a`, `${c.prefixo}-b`]);
    assert.equal(cheia?.lotes[0]?.quantidade, "10");
    assert.equal(cheia?.lotes[0]?.unidade_medida, "UN");
    assert.equal(cheia?.lotes[0]?.produto, `${c.prefixo}-prod`);
    assert.equal(cheia?.lotes[1]?.status_lote, "bloqueado");
    assert.equal(cheia?.lotes[1]?.quantidade, "4.5");
    assert.equal(pagina.dados[1]?.id_localizacao, posicaoVazia);
    assert.equal(pagina.dados[1]?.capacidade, null);
    assert.deepEqual(pagina.dados[1]?.lotes, []);
    assert.equal(pagina.dados[1]?.total_lotes, 0);
    assert.ok(!("ocupacao" in (cheia ?? {})) && !("percentual" in (cheia ?? {})));
  });

  it("lote com saldo 0 não aparece; paginação por localização e filtro por corredor", async () => {
    const todos = await mapa(`corredor=${corredor}&limite=100`);
    assert.ok(todos.dados.every((p) => p.lotes.every((l) => l.numero_lote !== `${c.prefixo}-zerado`)));
    const primeira = await mapa(`corredor=${corredor}&limite=2&pagina=1`);
    const segunda = await mapa(`corredor=${corredor}&limite=2&pagina=2`);
    assert.equal(primeira.dados.length, 2);
    assert.equal(segunda.dados.length, 1);
    assert.equal(primeira.total, 3);
    assert.equal((await mapa("corredor=ZZZZ-NAO")).total, 0);
    assert.equal((await mapa("")).limite, 100);
  });

  it("os dois perfis consultam; validação, sem token e sem rotas de escrita", async () => {
    assert.equal((await mapa(`corredor=${corredor}`, c.admin)).total, 3);
    for (const consulta of ["limite=101", "pagina=0", "corredor=a&corredor=b", "corredor=%00", `corredor=${"x".repeat(11)}`, "corredor="]) {
      assert.equal((await chamarApi(servidor, "GET", `/mapa?${consulta}`, c.operador)).status, 400, consulta);
    }
    assert.equal((await chamarApi(servidor, "GET", "/mapa")).status, 401);
    for (const metodo of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal((await chamarApi(servidor, metodo, "/mapa", c.admin, metodo === "DELETE" ? undefined : {})).status, 404);
    }
  });

  it("uma página cheia (100 posições) responde dentro do alvo de 1,5 s", async () => {
    const antes = Date.now();
    const pagina = await mapa("limite=100");
    assert.ok(pagina.dados.length <= 100);
    assert.ok(Date.now() - antes < 1500);
  });

  it("G1c: no máximo 50 lotes por posição, com total_lotes da posição, em ordem estável, e o restante pela listagem de lotes filtrada por localização", async () => {
    const lotada = (await prisma.localizacao.create({ data: { corredor: `${corredor}`.slice(0, 9) + "L", nivel: "9", posicao: "Z" } })).id_localizacao;
    await prisma.lote.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        numero_lote: `${c.prefixo}-m${String(i).padStart(2, "0")}`,
        id_produto: c.idProduto,
        id_localizacao: lotada,
        quantidade: "1",
      })),
    });
    const pagina = await mapa(`corredor=${encodeURIComponent(`${corredor}`.slice(0, 9) + "L")}`);
    const posicao = pagina.dados.find((p) => p.id_localizacao === lotada);
    assert.equal(posicao?.total_lotes, 55);
    assert.equal(posicao?.lotes.length, 50);
    const numeros = posicao?.lotes.map((l) => l.numero_lote) ?? [];
    assert.deepEqual(numeros, [...numeros].sort());
    assert.equal(numeros[0], `${c.prefixo}-m00`);
    assert.equal(numeros.at(-1), `${c.prefixo}-m49`);
    const restante = await chamarApi(servidor, "GET", `/lotes?id_localizacao=${lotada}&limite=100`, c.operador);
    assert.equal(restante.status, 200);
    assert.equal((restante.corpo as { total: number }).total, 55);
  });
});
