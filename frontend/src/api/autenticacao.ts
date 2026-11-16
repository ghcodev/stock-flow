import type { Cliente } from "./cliente.ts";
import type { ResultadoLogin, UsuarioPublico } from "./tipos.ts";

export function entrar(cliente: Cliente, email: string, senha: string): Promise<ResultadoLogin> {
  return cliente.post<ResultadoLogin>("/auth/login", { email, senha });
}

export async function consultarUsuarioAtual(cliente: Cliente, sinal?: AbortSignal): Promise<UsuarioPublico> {
  const resposta = await cliente.get<{ usuario: UsuarioPublico }>("/auth/me", undefined, sinal);
  return resposta.usuario;
}
