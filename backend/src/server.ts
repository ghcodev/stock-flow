import { criarEncerramento, instalarProtecoes } from "./lifecycle.ts";

const protecoes = instalarProtecoes((codigo) => process.exit(codigo));

async function iniciar(): Promise<void> {
  const { config } = await import("./config.ts");
  const { app } = await import("./app.ts");
  const { prisma } = await import("./db.ts");
  const { criarDesconexao, iniciarAgendador, marcarLotesVencidos } = await import("./agendador.ts");

  const server = app.listen(config.port, (erro?: Error) => {
    if (erro) return;
    process.stdout.write(`StockFlow API na porta ${config.port}\n`);
  });
  const agendador = config.agendadorAtivo ? iniciarAgendador(() => marcarLotesVencidos()) : null;
  const encerrar = criarEncerramento(server, {
    desconectar: criarDesconexao(agendador, () => prisma.$disconnect()),
    sair: (codigo) => process.exit(codigo),
    limiteMs: 10_000,
  });
  protecoes.definirEncerramento(encerrar, server);
}

iniciar().catch((err: unknown) => protecoes.falhar(err));
