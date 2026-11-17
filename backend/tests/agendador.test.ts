import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { criarDesconexao, iniciarAgendador, marcarLotesVencidos } from "../src/agendador.ts";
import { desativarUsuariosTeste, subir, type Servidor } from "./helpers.ts";
import { montarCenario, type Cenario } from "./movimentacao.apoio.ts";

const esperar = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

describe("agendador diário (A23, RN08)", () => {
  let servidor: Servidor;
  let c: Cenario;
  let ids: Record<string, number>;

  const statusDe = async (id: number): Promise<string> =>
    (await prisma.lote.findUniqueOrThrow({ where: { id_lote: id } })).status_lote;
  const logsDo = (id: number) =>
    prisma.$queryRaw<{ operacao: string; id_usuario: number | null; ip: string | null; antes: string | null; depois: string | null }[]>`
      SELECT operacao::text AS operacao, id_usuario, host(ip_usuario) AS ip,
             valor_anterior->>'status_lote' AS antes, valor_novo->>'status_lote' AS depois
      FROM auditoria_log WHERE tabela_afetada = 'lote' AND (valor_novo->>'id_lote')::int = ${id} ORDER BY id_log`;
  const validade = async (id: number, deslocamento: number | null): Promise<void> => {
    if (deslocamento === null) await prisma.$executeRaw`UPDATE lote SET data_validade = NULL WHERE id_lote = ${id}`;
    else await prisma.$executeRaw`UPDATE lote SET data_validade = hoje_operacional() + ${deslocamento}::int WHERE id_lote = ${id}`;
  };

  before(async () => {
    servidor = await subir(createApp());
    c = await montarCenario(servidor, "AG");
    ids = {};
    for (const [nome, deslocamento] of [
      ["ontem", -1],
      ["antigo", -400],
      ["hoje", 0],
      ["amanha", 1],
      ["semvalidade", null],
      ["bloqueado", -3],
      ["jaVencido", -5],
    ] as [string, number | null][]) {
      ids[nome] = await c.novoLote(nome, { quantidade: "2" });
      await validade(ids[nome] ?? 0, deslocamento);
    }
    await prisma.lote.update({ where: { id_lote: ids["bloqueado"] ?? 0 }, data: { status_lote: "bloqueado" } });
    await prisma.lote.update({ where: { id_lote: ids["jaVencido"] ?? 0 }, data: { status_lote: "vencido" } });
  });

  after(async () => {
    await servidor.fechar();
    await c.encerrar();
    await desativarUsuariosTeste();
    await prisma.$disconnect();
  });

  it("marca como vencido só o ativo com validade anterior ao hoje operacional do banco; hoje, futuro, sem validade, bloqueado e já vencido ficam como estão", async () => {
    const escopo = { idsDeLote: Object.values(ids) };
    const marcados = await marcarLotesVencidos(escopo);
    assert.equal(marcados, 2);
    assert.equal(await statusDe(ids["ontem"] ?? 0), "vencido");
    assert.equal(await statusDe(ids["antigo"] ?? 0), "vencido");
    assert.equal(await statusDe(ids["hoje"] ?? 0), "ativo");
    assert.equal(await statusDe(ids["amanha"] ?? 0), "ativo");
    assert.equal(await statusDe(ids["semvalidade"] ?? 0), "ativo");
    assert.equal(await statusDe(ids["bloqueado"] ?? 0), "bloqueado");
    assert.equal(await statusDe(ids["jaVencido"] ?? 0), "vencido");
  });

  it("a auditoria da ação do sistema grava usuário e IP nulos, com o status de ativo para vencido", async () => {
    const linhas = await logsDo(ids["ontem"] ?? 0);
    const ultima = linhas.at(-1);
    assert.equal(ultima?.operacao, "UPDATE");
    assert.equal(ultima?.id_usuario, null);
    assert.equal(ultima?.ip, null);
    assert.equal(ultima?.antes, "ativo");
    assert.equal(ultima?.depois, "vencido");
  });

  it("rodar de novo não marca nem gera log repetido", async () => {
    const escopo = { idsDeLote: Object.values(ids) };
    const antes = (await Promise.all(Object.values(ids).map(async (id) => (await logsDo(id)).length))).reduce((a, b) => a + b, 0);
    assert.equal(await marcarLotesVencidos(escopo), 0);
    const depois = (await Promise.all(Object.values(ids).map(async (id) => (await logsDo(id)).length))).reduce((a, b) => a + b, 0);
    assert.equal(depois, antes);
  });

  it("não herda o usuário de uma conexão do pool com variável de sessão antiga", async () => {
    const lote = await c.novoLote("envenenado", { quantidade: "1" });
    await validade(lote, -2);
    await Promise.all(
      Array.from({ length: 10 }, () => prisma.$queryRaw`SELECT set_config('app.user_id', '999999', false) AS a, set_config('app.ip', '203.0.113.7', false) AS b, pg_sleep(0.2)::text AS s`),
    );
    try {
      assert.equal(await marcarLotesVencidos({ idsDeLote: [lote] }), 1);
      const ultima = (await logsDo(lote)).at(-1);
      assert.equal(ultima?.id_usuario, null);
      assert.equal(ultima?.ip, null);
    } finally {
      await Promise.all(
        Array.from({ length: 10 }, () => prisma.$queryRaw`SELECT set_config('app.user_id', '', false) AS a, set_config('app.ip', '', false) AS b, pg_sleep(0.2)::text AS s`),
      );
    }
  });

  it("temporizador: roda uma vez ao iniciar, repete no intervalo, não sobrepõe, falha só escreve mensagem fixa e para ao encerrar", async () => {
    let chamadas = 0;
    let simultaneas = 0;
    let maximo = 0;
    const mensagens: string[] = [];
    const agendador = iniciarAgendador(
      async () => {
        chamadas += 1;
        simultaneas += 1;
        maximo = Math.max(maximo, simultaneas);
        await esperar(60);
        simultaneas -= 1;
        if (chamadas === 2) throw new Error("SEGREDO postgres://u:senha@h/d");
      },
      20,
      (texto) => mensagens.push(texto),
    );
    await esperar(400);
    await agendador.parar();
    const aoParar = chamadas;
    assert.ok(aoParar >= 3, `chamadas ${aoParar}`);
    assert.equal(maximo, 1);
    assert.deepEqual(mensagens, ["Agendador: falha na execução\n"]);
    assert.doesNotMatch(mensagens.join(""), /SEGREDO|senha|postgres/);
    await esperar(150);
    assert.equal(chamadas, aoParar);
  });

  it("parar espera a execução em curso e o encerramento para o agendador antes de desconectar o banco", async () => {
    const ordem: string[] = [];
    let terminou = false;
    const agendador = iniciarAgendador(async () => {
      ordem.push("inicio");
      await esperar(150);
      terminou = true;
      ordem.push("fim");
    }, 60_000);
    await esperar(30);
    const desconectar = criarDesconexao(agendador, async () => {
      ordem.push("desconectar");
      assert.equal(terminou, true);
    });
    await desconectar();
    assert.deepEqual(ordem, ["inicio", "fim", "desconectar"]);
    await criarDesconexao(null, async () => {
      ordem.push("sem-agendador");
    })();
    assert.equal(ordem.at(-1), "sem-agendador");
  });

  it("AGENDADOR_ATIVO só liga com o texto exato true", () => {
    const ler = (valor: string | undefined): string => {
      const ambiente: NodeJS.ProcessEnv = { ...process.env };
      delete ambiente.NODE_TEST_CONTEXT;
      if (valor === undefined) delete ambiente.AGENDADOR_ATIVO;
      else ambiente.AGENDADOR_ATIVO = valor;
      const r = spawnSync(
        process.execPath,
        ["--env-file=.env", "--input-type=module", "-e", 'import { config } from "./src/config.ts"; process.stdout.write(String(config.agendadorAtivo));'],
        { env: ambiente, encoding: "utf8", timeout: 20000 },
      );
      assert.equal(r.status, 0, r.stderr);
      return r.stdout;
    };
    assert.equal(ler("true"), "true");
    assert.equal(ler("false"), "false");
    assert.equal(ler("TRUE"), "false");
    assert.equal(ler("1"), "false");
    assert.equal(ler(undefined), "false");
  });
});
