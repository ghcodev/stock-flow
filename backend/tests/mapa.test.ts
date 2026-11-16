import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";

type LoteMapa = { id_lote: number; numero_lote: string; status_lote: string; quantidade: string; unidade_medida: string; produto: string };
type Posicao = { id_localizacao: number; corredor: string; nivel: string; posicao: string; capacidade: string | null; descricao: string | null; lotes: LoteMapa[] };
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
    assert.deepEqual(cheia?.lotes.map((l) => l.numero_lote), [`${c.prefixo}-a`, `${c.prefixo}-b`]);
    assert.equal(cheia?.lotes[0]?.quantidade, "10");
    assert.equal(cheia?.lotes[0]?.unidade_medida, "UN");
    assert.equal(cheia?.lotes[0]?.produto, `${c.prefixo}-prod`);
    assert.equal(cheia?.lotes[1]?.status_lote, "bloqueado");
    assert.equal(cheia?.lotes[1]?.quantidade, "4.5");
    assert.equal(pagina.dados[1]?.id_localizacao, posicaoVazia);
    assert.equal(pagina.dados[1]?.capacidade, null);
    assert.deepEqual(pagina.dados[1]?.lotes, []);
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
});
