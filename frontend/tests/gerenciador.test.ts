import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarGerenciadorSerial } from "../src/leitor/gerenciador.ts";
import type { Leitura } from "../src/leitor/detector.ts";
import { conectarSerial, type ConexaoSerial, type OpcoesDeConexao, type PortaSerial } from "../src/leitor/serial.ts";

const ambienteSeguro = { isSecureContext: true, navigator: { serial: { requestPort: () => Promise.reject(new Error("não usado")) } } };

function montar(ambiente: { isSecureContext: boolean; navigator: { serial?: unknown } } = ambienteSeguro) {
  const emitidas: Leitura[] = [];
  const aberturas: OpcoesDeConexao[] = [];
  let encerramentos = 0;
  let liberar: ((conexao: ConexaoSerial) => void) | null = null;
  let recusar: ((falha: unknown) => void) | null = null;
  const gerenciador = criarGerenciadorSerial({
    ambiente: () => ambiente,
    emitir: (leitura) => emitidas.push(leitura),
    conectarPorta: (_ambiente, opcoes) => {
      aberturas.push(opcoes);
      return new Promise<ConexaoSerial>((resolver, rejeitar) => {
        liberar = resolver;
        recusar = rejeitar;
      });
    },
  });
  const conexao: ConexaoSerial = {
    encerrar: () => {
      encerramentos += 1;
      return Promise.resolve();
    },
  };
  return { gerenciador, emitidas, aberturas, conexao, encerramentos: () => encerramentos, abrir: () => liberar?.(conexao), falhar: (f: unknown) => recusar?.(f) };
}

const aguardar = () => new Promise((resolver) => setTimeout(resolver, 5));

describe("gerenciador único da conexão serial (S4)", () => {
  it("expõe disponibilidade e não conecta sem contexto seguro", () => {
    const sem = montar({ isSecureContext: false, navigator: { serial: {} } });
    assert.equal(sem.gerenciador.estado().disponivel, false);
    sem.gerenciador.conectar();
    assert.equal(sem.aberturas.length, 0);
    assert.equal(montar().gerenciador.estado().disponivel, true);
  });

  it("uma única conexão: chamadas repetidas durante e depois de conectar não abrem outra", async () => {
    const t = montar();
    t.gerenciador.conectar();
    t.gerenciador.conectar();
    assert.equal(t.gerenciador.estado().conectando, true);
    t.abrir();
    await aguardar();
    t.gerenciador.conectar();
    assert.equal(t.aberturas.length, 1);
    assert.deepEqual({ ...t.gerenciador.estado() }, { disponivel: true, conectado: true, conectando: false, erro: null });
  });

  it("várias telas assinam o mesmo estado e as leituras seriais chegam ao barramento", async () => {
    const t = montar();
    let avisos = 0;
    const cancelarA = t.gerenciador.assinar(() => (avisos += 1));
    t.gerenciador.assinar(() => (avisos += 1));
    t.gerenciador.conectar();
    t.abrir();
    await aguardar();
    t.aberturas[0]?.aoLer({ codigo: "LOTE-1", origem: "serial", intervaloMedioMs: null });
    assert.deepEqual(t.emitidas.map((l) => l.codigo), ["LOTE-1"]);
    assert.ok(avisos >= 4);
    cancelarA();
    const antes = avisos;
    t.gerenciador.desconectar();
    assert.equal(avisos, antes + 1);
  });

  it("desconectar (logout) encerra a conexão e zera o estado", async () => {
    const t = montar();
    t.gerenciador.conectar();
    t.abrir();
    await aguardar();
    t.gerenciador.desconectar();
    assert.equal(t.encerramentos(), 1);
    assert.equal(t.gerenciador.estado().conectado, false);
    t.gerenciador.desconectar();
    assert.equal(t.encerramentos(), 1);
  });

  it("desconectar enquanto conecta descarta a conexão que chegar depois", async () => {
    const t = montar();
    t.gerenciador.conectar();
    t.gerenciador.desconectar();
    t.abrir();
    await aguardar();
    assert.equal(t.encerramentos(), 1);
    assert.equal(t.gerenciador.estado().conectado, false);
  });

  it("recusa do usuário não é erro; falha real mostra mensagem fixa; queda da porta limpa o estado", async () => {
    const cancelado = montar();
    cancelado.gerenciador.conectar();
    cancelado.falhar({ name: "NotFoundError" });
    await aguardar();
    assert.equal(cancelado.gerenciador.estado().erro, null);
    assert.equal(cancelado.gerenciador.estado().conectando, false);

    const falho = montar();
    falho.gerenciador.conectar();
    falho.falhar(new Error("detalhe interno"));
    await aguardar();
    assert.equal(falho.gerenciador.estado().erro, "Não foi possível abrir a porta serial.");

    const queda = montar();
    queda.gerenciador.conectar();
    queda.abrir();
    await aguardar();
    queda.aberturas[0]?.aoEncerrar(new TypeError("porta removida"));
    assert.equal(queda.gerenciador.estado().conectado, false);
    queda.gerenciador.conectar();
    assert.equal(queda.aberturas.length, 2);
  });

  it("leitura de uma conexão que já foi trocada ou desconectada não chega ao barramento (T2)", async () => {
    const t = montar();
    t.gerenciador.conectar();
    t.abrir();
    await aguardar();
    t.gerenciador.desconectar();
    t.aberturas[0]?.aoLer({ codigo: "TARDIA-1", origem: "serial", intervaloMedioMs: null });
    assert.deepEqual(t.emitidas, []);
    assert.equal(t.aberturas[0]?.cancelado?.(), true);
  });
});

describe("abertura pendente da porta serial (T2)", () => {
  function portaControlada() {
    const fluxo = new ReadableStream<Uint8Array>({ start() {} });
    const estado = { abriu: 0, fechou: 0, resolverPorta: null as ((porta: PortaSerial) => void) | null, resolverAbertura: null as (() => void) | null };
    const porta: PortaSerial = {
      open: () => {
        estado.abriu += 1;
        return new Promise<void>((resolver) => {
          estado.resolverAbertura = resolver;
        });
      },
      close: () => {
        estado.fechou += 1;
        return Promise.resolve();
      },
      readable: fluxo,
    };
    const ambiente = {
      isSecureContext: true,
      navigator: {
        serial: {
          requestPort: () =>
            new Promise<PortaSerial>((resolver) => {
              estado.resolverPorta = resolver;
            }),
        },
      },
    };
    return { estado, porta, ambiente };
  }

  it("cancelada enquanto o usuário escolhe a porta: não abre nem lê", async () => {
    const c = portaControlada();
    let cancelado = false;
    const tentativa = conectarSerial(c.ambiente, { aoLer: () => undefined, aoEncerrar: () => undefined, cancelado: () => cancelado });
    cancelado = true;
    c.estado.resolverPorta?.(c.porta);
    await assert.rejects(tentativa, (erro: unknown) => erro instanceof DOMException && erro.name === "AbortError");
    assert.equal(c.estado.abriu, 0);
  });

  it("cancelada enquanto a porta abre: fecha na hora e não publica conexão", async () => {
    const c = portaControlada();
    let cancelado = false;
    const lidas: string[] = [];
    const tentativa = conectarSerial(c.ambiente, { aoLer: (l) => lidas.push(l.codigo), aoEncerrar: () => undefined, cancelado: () => cancelado });
    c.estado.resolverPorta?.(c.porta);
    await aguardar();
    cancelado = true;
    c.estado.resolverAbertura?.();
    await assert.rejects(tentativa, (erro: unknown) => erro instanceof DOMException && erro.name === "AbortError");
    assert.equal(c.estado.fechou, 1);
    assert.deepEqual(lidas, []);
  });
});
