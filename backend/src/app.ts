import express, { type Express } from "express";
import { criarRotasPublicas } from "./routes/index.ts";
import { jsonReplacer } from "./serialization.ts";
import { rotaNaoEncontrada, tratadorDeErros } from "./middlewares/error.middleware.ts";

export function createApp(registrarRotasExtras?: (app: Express) => void): Express {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.set("json replacer", jsonReplacer);
  app.use(express.json({ limit: "100kb" }));
  app.use(criarRotasPublicas());
  registrarRotasExtras?.(app);
  app.use(rotaNaoEncontrada);
  app.use(tratadorDeErros);
  return app;
}

export const app = createApp();
