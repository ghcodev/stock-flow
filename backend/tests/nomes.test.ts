import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { marcarLotesVencidos } from "../src/agendador.ts";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";

type Item = { id_movimentacao: string; id_lote: number; id_usuario: number; numero_lote: string; nome_usuario: string };
type Lista = { dados: Item[]; total: number };

describe("nomes nas listas de movimentações, contagens e auditoria (H2)", () => {
  let servidor: Servidor;
  let c: Cenario;
  let lote: number;
  let numero: string;
  let nomeOperador: string;
  let nomeAdmin: string;

  const get = (caminho: string, token: string) => chamarApi(servidor, "GET", caminho, token);

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "NM");
    numero = `${c.prefixo}-a`;
    lote = await c.novoLote("a", { quantidade: 10 });
    nomeOperador = (await prisma.usuario.findUniqueOrThrow({ where: { id_usuario: c.operadorUsuario.id } })).nome;
    nomeAdmin = (await prisma.usuario.findUniqueOrThrow({ where: { id_usuario: c.adminUsuario.id } })).nome;
    const saida = await chamarApi(servidor, "POST", "/movimentacoes/saida", c.admin, { id_lote: lote, quantidade: 1 });
    assert.equal(saida.status, 201, saida.texto);
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("GET /movimentacoes e /movimentacoes/:id trazem numero_lote e nome_usuario do autor, sem e-mail nem hash", async () => {
    for (const token of [c.operador, c.admin]) {
      const r = await get(`/movimentacoes?id_lote=${lote}`, token);
      assert.equal(r.status, 200, r.texto);
      const lista = r.corpo as Lista;
      assert.equal(lista.total, 2);
      assert.deepEqual(
        lista.dados.map((m) => [m.numero_lote, m.nome_usuario]),
        [
          [numero, nomeAdmin],
          [numero, nomeOperador],
        ],
      );
      assert.doesNotMatch(r.texto, /senha_hash|email|@teste\.local|\$2[aby]\$/);
      const um = await get(`/movimentacoes/${lista.dados[0]?.id_movimentacao}`, token);
      assert.equal(um.status, 200);
      const corpo = um.corpo as Item & { usuario?: unknown; lote?: unknown };
      assert.equal(corpo.numero_lote, numero);
      assert.equal(corpo.nome_usuario, nomeAdmin);
      assert.equal(corpo.id_usuario, c.adminUsuario.id);
      assert.equal(corpo.usuario, undefined);
      assert.equal(corpo.lote, undefined);
      assert.doesNotMatch(um.texto, /senha_hash|email|@teste\.local/);
    }
  });

  it("contagens: lista e por id trazem os nomes e mantêm a divergência", async () => {
    const criada = await chamarApi(servidor, "POST", "/inventario/contagens", c.operador, { id_lote: lote, quantidade_contada: 7 });
    assert.equal(criada.status, 201, criada.texto);
    const id = (criada.corpo as { id_movimentacao: string }).id_movimentacao;
    for (const token of [c.operador, c.admin]) {
      const lista = await get(`/inventario/contagens?id_lote=${lote}`, token);
      assert.equal(lista.status, 200, lista.texto);
      const itens = (lista.corpo as { dados: (Item & { divergencia: string })[] }).dados;
      assert.equal(itens.length, 1);
      assert.deepEqual(
        { n: itens[0]?.numero_lote, u: itens[0]?.nome_usuario, d: itens[0]?.divergencia },
        { n: numero, u: nomeOperador, d: "-2" },
      );
      const um = await get(`/inventario/contagens/${id}`, token);
      assert.equal(um.status, 200);
      const corpo = um.corpo as Item & { divergencia: string };
      assert.deepEqual({ n: corpo.numero_lote, u: corpo.nome_usuario, d: corpo.divergencia }, { n: numero, u: nomeOperador, d: "-2" });
      assert.doesNotMatch(um.texto + lista.texto, /senha_hash|email|@teste\.local/);
    }
  });

  it("GET /auditoria traz nome_usuario do autor e null quando a ação é do sistema", async () => {
    const vencido = await c.novoLote("b", { quantidade: 1 });
    await prisma.$executeRaw`UPDATE lote SET data_validade = current_date - 1 WHERE id_lote = ${vencido}`;
    assert.equal(await marcarLotesVencidos({ idsDeLote: [vencido] }), 1);
    const filtro = encodeURIComponent(JSON.stringify({ id_lote: vencido, status_lote: "vencido" }));
    const sistema = await get(`/auditoria?tabela=lote&valor_novo=${filtro}`, c.admin);
    assert.equal(sistema.status, 200, sistema.texto);
    const itens = (sistema.corpo as { dados: { id_usuario: number | null; nome_usuario: string | null }[] }).dados;
    assert.equal(itens.length, 1);
    assert.deepEqual({ id: itens[0]?.id_usuario, nome: itens[0]?.nome_usuario }, { id: null, nome: null });

    const humano = await get(`/auditoria?tabela=movimentacao&id_usuario=${c.adminUsuario.id}&limite=5`, c.admin);
    assert.equal(humano.status, 200, humano.texto);
    const linhas = (humano.corpo as { dados: { id_usuario: number; nome_usuario: string | null }[] }).dados;
    assert.ok(linhas.length >= 1);
    assert.ok(linhas.every((l) => l.id_usuario === c.adminUsuario.id && l.nome_usuario === nomeAdmin));
    assert.doesNotMatch(humano.texto, /senha_hash|@teste\.local|\$2[aby]\$/);
  });
});
