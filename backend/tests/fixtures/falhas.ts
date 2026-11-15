import http from "node:http";
import { criarEncerramento, instalarProtecoes } from "../../src/lifecycle.ts";

const modo = process.argv[2];

const server = http.createServer((_req, res) => res.end("ok"));
const encerrar = criarEncerramento(server, {
  desconectar: modo === "desconectar-pendente" ? () => new Promise<void>(() => {}) : async () => {},
  sair: (codigo) => process.exit(codigo),
  limiteMs: 400,
});
instalarProtecoes(server, encerrar);

if (modo === "porta-ocupada") {
  const ocupante = http.createServer();
  ocupante.listen(0, "127.0.0.1", () => {
    const porta = (ocupante.address() as { port: number }).port;
    server.listen(porta, "127.0.0.1");
  });
} else {
  server.listen(0, "127.0.0.1", () => {
    setImmediate(() => {
      if (modo === "excecao") throw new Error("SEGREDO-NA-EXCECAO");
      if (modo === "rejeicao") Promise.reject(new Error("SEGREDO-NA-REJEICAO"));
      if (modo === "sigterm") process.emit("SIGTERM");
      if (modo === "sigint") process.emit("SIGINT");
      if (modo === "desconectar-pendente") void encerrar(0);
    });
  });
}
