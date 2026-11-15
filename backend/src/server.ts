import { ConfigError } from "./errors.ts";

async function iniciar(): Promise<void> {
  let config;
  try {
    ({ config } = await import("./config.ts"));
  } catch (err) {
    const mensagem = err instanceof ConfigError ? err.message : "falha ao carregar a configuração";
    process.stderr.write(`Configuração inválida: ${mensagem}\n`);
    process.exit(1);
  }
  const { app } = await import("./app.ts");
  const { prisma } = await import("./db.ts");
  const { criarEncerramento, instalarProtecoes } = await import("./lifecycle.ts");

  const server = app.listen(config.port, () => {
    process.stdout.write(`StockFlow API na porta ${config.port}\n`);
  });
  const encerrar = criarEncerramento(server, () => prisma.$disconnect(), (codigo) => process.exit(codigo));
  instalarProtecoes(server, encerrar);
}

await iniciar();
