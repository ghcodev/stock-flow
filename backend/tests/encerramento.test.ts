import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { criarEncerramento } from "../src/lifecycle.ts";

function servidorLento(duracaoMs: number, eventos: string[]) {
  let recebida: () => void = () => {};
  const chegou = new Promise<void>((ok) => (recebida = ok));
  const server = http.createServer((_req, res) => {
    res.on("finish", () => eventos.push("resposta-enviada"));
    recebida();
    setTimeout(() => res.end("completo"), duracaoMs);
  });
  return new Promise<{ server: http.Server; url: string; chegou: Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}/`, chegou });
    });
  });
}

describe("encerramento", () => {
  it("espera a requisição em curso, desconecta depois e sai com 0 uma única vez", async () => {
    const eventos: string[] = [];
    const { server, url, chegou } = await servidorLento(300, eventos);
    const encerrar = criarEncerramento(server, {
      desconectar: async () => {
        eventos.push("desconectar");
      },
      sair: (codigo) => {
        eventos.push(`sair:${codigo}`);
      },
      limiteMs: 5000,
    });

    const resposta = fetch(url, { headers: { connection: "close" } }).then((r) => r.text());
    await chegou;
    const primeiro = encerrar(0);
    const segundo = encerrar(0);

    assert.equal(await resposta, "completo");
    await Promise.all([primeiro, segundo]);
    assert.deepEqual(eventos, ["resposta-enviada", "desconectar", "sair:0"]);
  });

  it("estourado o tempo limite, sai com 1 sem desconectar", async () => {
    const { server, url, chegou } = await servidorLento(3000, []);
    let desconectou = false;
    const saidas: number[] = [];
    const encerrar = criarEncerramento(server, {
      desconectar: async () => {
        desconectou = true;
      },
      sair: (codigo) => saidas.push(codigo),
      limiteMs: 150,
    });

    const resposta = fetch(url, { headers: { connection: "close" } }).catch(() => null);
    await chegou;
    void encerrar(0);
    await new Promise((ok) => setTimeout(ok, 400));
    assert.deepEqual(saidas, [1]);
    assert.equal(desconectou, false);
    server.closeAllConnections();
    await resposta;
  });
});
