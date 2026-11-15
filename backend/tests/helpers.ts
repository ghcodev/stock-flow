import type { Express } from "express";
import type { AddressInfo } from "node:net";

export type Servidor = { url: string; fechar: () => Promise<void> };

export function subir(app: Express): Promise<Servidor> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        fechar: () => new Promise((ok) => server.close(() => ok())),
      });
    });
  });
}
