import { app } from "./app.ts";
import { config } from "./config.ts";
import { prisma } from "./db.ts";

const server = app.listen(config.port, () => {
  process.stdout.write(`StockFlow API na porta ${config.port}\n`);
});

async function encerrar(): Promise<void> {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", encerrar);
process.on("SIGINT", encerrar);
