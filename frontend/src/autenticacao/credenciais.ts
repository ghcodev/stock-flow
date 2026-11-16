import { ErroDaApi, ErroDeRede, mensagemDoErro } from "../api/erros.ts";

export type ErrosDoLogin = {
  email?: string;
  senha?: string;
};

export type FalhaDoLogin = {
  geral: string | null;
  campos: ErrosDoLogin;
};

export const MENSAGEM_DE_CREDENCIAIS_INVALIDAS = "E-mail ou senha inválidos.";

const MAX_EMAIL = 160;
const MAX_BYTES_SENHA = 72;
const FORMATO_DE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validarCredenciais(emailBruto: string, senha: string): ErrosDoLogin {
  const erros: ErrosDoLogin = {};
  const email = emailBruto.trim();
  if (email === "") erros.email = "Informe o e-mail.";
  else if (email.length > MAX_EMAIL) erros.email = `O e-mail deve ter até ${MAX_EMAIL} caracteres.`;
  else if (!FORMATO_DE_EMAIL.test(email)) erros.email = "Informe um e-mail válido.";
  if (senha === "") erros.senha = "Informe a senha.";
  else if (senha.includes("\0")) erros.senha = "A senha contém caractere inválido.";
  else if (new TextEncoder().encode(senha).length > MAX_BYTES_SENHA) erros.senha = `A senha deve ter no máximo ${MAX_BYTES_SENHA} bytes.`;
  return erros;
}

export function temErros(erros: ErrosDoLogin): boolean {
  return erros.email !== undefined || erros.senha !== undefined;
}

function minutosParaTexto(segundos: number | null): string {
  if (segundos === null || segundos <= 0) return "alguns minutos";
  const minutos = Math.ceil(segundos / 60);
  return minutos === 1 ? "1 minuto" : `${minutos} minutos`;
}

export function interpretarFalhaDoLogin(erro: unknown): FalhaDoLogin {
  if (erro instanceof ErroDaApi) {
    if (erro.status === 401) return { geral: MENSAGEM_DE_CREDENCIAIS_INVALIDAS, campos: {} };
    if (erro.status === 429) {
      return { geral: `Muitas tentativas de acesso. Aguarde ${minutosParaTexto(erro.segundosParaRepetir)} e tente novamente.`, campos: {} };
    }
    if (erro.status === 400) {
      const campos: ErrosDoLogin = {};
      for (const campo of erro.campos) {
        if (campo.campo === "email" && campos.email === undefined) campos.email = campo.mensagem;
        if (campo.campo === "senha" && campos.senha === undefined) campos.senha = campo.mensagem;
      }
      return temErros(campos) ? { geral: null, campos } : { geral: "Verifique os dados informados.", campos };
    }
    return { geral: mensagemDoErro(erro), campos: {} };
  }
  if (erro instanceof ErroDeRede) return { geral: mensagemDoErro(erro), campos: {} };
  return { geral: "Não foi possível entrar agora. Tente novamente.", campos: {} };
}

export function destinoAposLogin(origem: unknown): string {
  if (typeof origem !== "string") return "/";
  if (!origem.startsWith("/") || origem.startsWith("//") || origem.startsWith("/\\")) return "/";
  if (origem === "/entrar") return "/";
  return origem;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((p) => p !== "");
  const primeira = partes[0]?.[0] ?? "?";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return `${primeira}${ultima}`.toUpperCase();
}

export function rotuloDoPerfil(perfil: "administrador" | "operador"): string {
  return perfil === "administrador" ? "Administrador" : "Operador";
}
