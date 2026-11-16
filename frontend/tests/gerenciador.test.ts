import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { criarGerenciadorSerial } from "../src/leitor/gerenciador.ts";
import type { Leitura } from "../src/leitor/detector.ts";
import type { ConexaoSerial, OpcoesDeConexao } from "../src/leitor/serial.ts";

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
});
