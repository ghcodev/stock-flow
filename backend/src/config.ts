import { ConfigError } from "./errors.ts";

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor || valor.trim() === "") {
    throw new ConfigError(`Variável de ambiente obrigatória ausente: ${nome}`);
  }
  return valor;
}

const jwtSecret = obrigatoria("JWT_SECRET");
if (jwtSecret.length < 32) {
  throw new ConfigError("JWT_SECRET deve ter no mínimo 32 caracteres");
}

const port = Number(process.env.PORT ?? "3000");
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new ConfigError("PORT inválida");
}

export const config = {
  databaseUrl: obrigatoria("DATABASE_URL"),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  port,
};
