import type { Server } from "node:http";

export type Encerramento = (codigo: number) => Promise<void>;

export function criarEncerramento(
  server: Server,
  desconectar: () => Promise<void>,
  sair: (codigo: number) => void,
): Encerramento {
  return async (codigo) => {
    server.close();
    try {
      await desconectar();
    } finally {
      sair(codigo);
    }
  };
}

export function instalarProtecoes(server: Server, encerrar: Encerramento): void {
  const fatal = (mensagem: string): void => {
    process.stderr.write(`${mensagem}\n`);
    void encerrar(1);
  };
  process.on("uncaughtException", () => fatal("Erro fatal: exceção não tratada"));
  process.on("unhandledRejection", () => fatal("Erro fatal: promessa rejeitada sem tratamento"));
  server.on("error", () => fatal("Erro fatal: falha no servidor HTTP"));
  process.on("SIGTERM", () => void encerrar(0));
  process.on("SIGINT", () => void encerrar(0));
}
