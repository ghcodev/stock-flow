import type { Server } from "node:http";
import { ConfigError } from "./errors.ts";

export type Encerramento = (codigo: number) => Promise<void>;

export type OpcoesEncerramento = {
  desconectar: () => Promise<void>;
  sair: (codigo: number) => void;
  limiteMs: number;
};

export function criarEncerramento(server: Server, opcoes: OpcoesEncerramento): Encerramento {
  const { desconectar, sair, limiteMs } = opcoes;
  let emAndamento: Promise<void> | null = null;

  return (codigo) => {
    if (emAndamento) {
      if (codigo !== 0) sair(1);
      return emAndamento;
    }
    let ociosas: NodeJS.Timeout | undefined;
    const prazo = setTimeout(() => {
      clearInterval(ociosas);
      sair(1);
    }, limiteMs);
    emAndamento = (async () => {
      try {
        const fechado = new Promise<void>((ok) => server.close(() => ok()));
        ociosas = setInterval(() => server.closeIdleConnections(), 50);
        await fechado;
        clearInterval(ociosas);
        await desconectar();
        clearTimeout(prazo);
        sair(codigo);
      } catch {
        clearInterval(ociosas);
        clearTimeout(prazo);
        sair(1);
      }
    })();
    return emAndamento;
  };
}

export type Protecoes = {
  definirEncerramento: (encerrar: Encerramento, server: Server) => void;
  falhar: (err: unknown) => void;
};

export function instalarProtecoes(sair: (codigo: number) => void): Protecoes {
  let encerrar: Encerramento | null = null;
  const finalizar = (codigo: number): void => {
    if (encerrar) void encerrar(codigo);
    else sair(codigo);
  };
  const fatal = (mensagem: string): void => {
    process.stderr.write(`${mensagem}\n`);
    finalizar(1);
  };
  process.on("uncaughtException", () => fatal("Erro fatal: exceção não tratada"));
  process.on("unhandledRejection", () => fatal("Erro fatal: promessa rejeitada sem tratamento"));
  process.on("SIGTERM", () => finalizar(0));
  process.on("SIGINT", () => finalizar(0));

  return {
    definirEncerramento(novo, server) {
      encerrar = novo;
      server.on("error", () => fatal("Erro fatal: falha no servidor HTTP"));
    },
    falhar(err) {
      fatal(
        err instanceof ConfigError
          ? `Configuração inválida: ${err.message}`
          : "Erro fatal: falha na inicialização",
      );
    },
  };
}
