import { ErroDaApi } from "../api/erros.ts";
import type { Perfil } from "../api/tipos.ts";
import { contemNul, interpretarFalhaDeFormulario, type ErrosDeCampos, type FalhaDeFormulario } from "./formularios.ts";

export const MINIMO_DA_SENHA = 8;
export const MAXIMO_DE_BYTES_DA_SENHA = 72;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const codificador = new TextEncoder();

export function validarSenha(senha: string, rotulo = "A senha"): string | null {
  if (contemNul(senha)) return `${rotulo} contém caractere inválido.`;
  if ([...senha].length < MINIMO_DA_SENHA) return `${rotulo} deve ter no mínimo ${MINIMO_DA_SENHA} caracteres.`;
  if (codificador.encode(senha).length > MAXIMO_DE_BYTES_DA_SENHA) return `${rotulo} deve ter no máximo ${MAXIMO_DE_BYTES_DA_SENHA} bytes.`;
  return null;
}

export function validarTrocaDeSenha(atual: string, nova: string, confirmacao: string): ErrosDeCampos {
  const erros: ErrosDeCampos = {};
  if (atual === "") erros["senha_atual"] = "Informe a senha atual.";
  else if (contemNul(atual)) erros["senha_atual"] = "A senha atual contém caractere inválido.";
  const erroDaNova = validarSenha(nova, "A nova senha");
  if (erroDaNova) erros["nova_senha"] = erroDaNova;
  else if (nova === atual) erros["nova_senha"] = "A nova senha deve ser diferente da atual.";
  if (confirmacao === "") erros["confirmacao"] = "Repita a nova senha.";
  else if (confirmacao !== nova) erros["confirmacao"] = "A confirmação não confere com a nova senha.";
  return erros;
}

export type ValoresDeUsuario = {
  nome: string;
  email: string;
  perfil: string;
  senha: string;
};

export type UsuarioEditavel = { nome: string; email: string; perfil: Perfil };

export const VALORES_DE_USUARIO_VAZIOS: ValoresDeUsuario = { nome: "", email: "", perfil: "", senha: "" };

export function validarUsuario(valores: ValoresDeUsuario, criando: boolean): ErrosDeCampos {
  const erros: ErrosDeCampos = {};
  const nome = valores.nome.trim();
  if (nome === "") erros["nome"] = "Informe o nome.";
  else if (nome.length > 120) erros["nome"] = "O nome deve ter até 120 caracteres.";
  else if (contemNul(nome)) erros["nome"] = "O nome contém caractere inválido.";
  const email = valores.email.trim();
  if (email === "") erros["email"] = "Informe o e-mail.";
  else if (email.length > 160) erros["email"] = "O e-mail deve ter até 160 caracteres.";
  else if (!EMAIL.test(email) || contemNul(email)) erros["email"] = "Informe um e-mail válido.";
  if (valores.perfil !== "administrador" && valores.perfil !== "operador") erros["perfil"] = "Selecione o perfil.";
  if (criando || valores.senha !== "") {
    const erroDaSenha = valores.senha === "" ? "Informe a senha." : validarSenha(valores.senha);
    if (erroDaSenha) erros["senha"] = erroDaSenha;
  }
  return erros;
}

export type CorpoDeCriacao = { nome: string; email: string; perfil: Perfil; senha: string };
export type CorpoDeEdicao = { nome?: string; email?: string; perfil?: Perfil; senha?: string };

export function corpoDeCriacao(valores: ValoresDeUsuario): CorpoDeCriacao {
  return { nome: valores.nome.trim(), email: valores.email.trim().toLowerCase(), perfil: valores.perfil as Perfil, senha: valores.senha };
}

export function corpoDeEdicao(valores: ValoresDeUsuario, original: UsuarioEditavel): CorpoDeEdicao {
  const corpo: CorpoDeEdicao = {};
  const nome = valores.nome.trim();
  const email = valores.email.trim().toLowerCase();
  if (nome !== original.nome) corpo.nome = nome;
  if (email !== original.email.toLowerCase()) corpo.email = email;
  if (valores.perfil !== original.perfil) corpo.perfil = valores.perfil as Perfil;
  if (valores.senha !== "") corpo.senha = valores.senha;
  return corpo;
}

export function semAlteracao(corpo: CorpoDeEdicao): boolean {
  return Object.keys(corpo).length === 0;
}

export function interpretarFalhaDeUsuario(erro: unknown): FalhaDeFormulario {
  if (erro instanceof ErroDaApi && (erro.status === 409 || erro.status === 422) && erro.codigo === "REGISTRO_DUPLICADO") {
    return { geral: null, campos: { email: "Já existe um usuário com este e-mail." }, incerta: false };
  }
  return interpretarFalhaDeFormulario(erro);
}

export function interpretarFalhaDeTrocaDeSenha(erro: unknown): FalhaDeFormulario & { segundosParaRepetir: number | null } {
  if (erro instanceof ErroDaApi) {
    if (erro.status === 422 && erro.codigo === "SENHA_ATUAL_INCORRETA") {
      return { geral: null, campos: { senha_atual: "A senha atual está incorreta." }, incerta: false, segundosParaRepetir: null };
    }
    if (erro.status === 429) {
      const espera = erro.segundosParaRepetir;
      const texto = espera !== null ? `Muitas tentativas. Aguarde ${espera} s para tentar de novo.` : "Muitas tentativas. Aguarde um pouco para tentar de novo.";
      return { geral: texto, campos: {}, incerta: false, segundosParaRepetir: espera };
    }
  }
  return { ...interpretarFalhaDeFormulario(erro), segundosParaRepetir: null };
}

export function textoDoPerfil(perfil: Perfil): string {
  return perfil === "administrador" ? "Administrador" : "Operador";
}
