import type { Server } from "node:http";

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
    const prazo = setTimeout(() => sair(1), limiteMs);
    prazo.unref();
    emAndamento = (async () => {
      try {
        await new Promise<void>((ok) => server.close(() => ok()));
        await desconectar();
        clearTimeout(prazo);
        sair(codigo);
      } catch {
        clearTimeout(prazo);
        sair(1);
      }
    })();
    return emAndamento;
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
