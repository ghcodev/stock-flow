import type { Cliente } from "./cliente.ts";
import type { Consulta, Pagina, Perfil } from "./tipos.ts";
import type { CorpoDeCriacao, CorpoDeEdicao } from "../util/usuarios.ts";

export type UsuarioGerenciado = {
  id_usuario: number;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  created_at: string;
};

export function listarUsuarios(cliente: Cliente, consulta: Consulta, sinal?: AbortSignal): Promise<Pagina<UsuarioGerenciado>> {
  return cliente.get<Pagina<UsuarioGerenciado>>("/usuarios", consulta, sinal);
}

export function criarUsuario(cliente: Cliente, corpo: CorpoDeCriacao): Promise<UsuarioGerenciado> {
  return cliente.post<UsuarioGerenciado>("/usuarios", corpo);
}

export function atualizarUsuario(cliente: Cliente, id: number, corpo: CorpoDeEdicao): Promise<UsuarioGerenciado> {
  return cliente.patch<UsuarioGerenciado>(`/usuarios/${id}`, corpo);
}

export function inativarUsuario(cliente: Cliente, id: number): Promise<UsuarioGerenciado> {
  return cliente.post<UsuarioGerenciado>(`/usuarios/${id}/inativar`);
}

export function trocarMinhaSenha(cliente: Cliente, senhaAtual: string, novaSenha: string): Promise<void> {
  return cliente.post<void>("/auth/senha", { senha_atual: senhaAtual, nova_senha: novaSenha });
}
