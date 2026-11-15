import bcrypt from "bcrypt";
import { prisma } from "../db.ts";
import { HttpError } from "../errors.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import type { perfil_usuario } from "../generated/prisma/enums.ts";
import { executarComoUsuario, type ContextoDeEscrita, type Tx } from "../transacao.ts";
import { intervaloDe, type Pagina, type Paginacao } from "../validators/comuns.ts";
import { literalParaLike } from "../busca.ts";

const CUSTO_BCRYPT = 12;

const SELECAO = {
  id_usuario: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
  created_at: true,
} as const;

export type UsuarioGerenciado = Prisma.usuarioGetPayload<{ select: typeof SELECAO }>;

export type DadosNovoUsuario = { nome: string; email: string; senha: string; perfil: perfil_usuario };

export type MudancasUsuario = {
  nome?: string;
  email?: string;
  perfil?: perfil_usuario;
  senha_hash?: string;
  ativo?: boolean;
};

export type FiltroUsuarios = Paginacao & { busca?: string; perfil?: perfil_usuario; ativo?: boolean };

export async function criarUsuario(contexto: ContextoDeEscrita, dados: DadosNovoUsuario): Promise<UsuarioGerenciado> {
  const senha_hash = await bcrypt.hash(dados.senha, CUSTO_BCRYPT);
  return executarComoUsuario(contexto, (tx) =>
    tx.usuario.create({
      data: { nome: dados.nome, email: dados.email, perfil: dados.perfil, senha_hash },
      select: SELECAO,
    }),
  );
}

export async function obterUsuario(id: number): Promise<UsuarioGerenciado> {
  const usuario = await prisma.usuario.findUnique({ where: { id_usuario: id }, select: SELECAO });
  if (!usuario) throw new HttpError(404, "NAO_ENCONTRADO", "Usuário não encontrado");
  return usuario;
}

export async function listarUsuarios(filtro: FiltroUsuarios): Promise<Pagina<UsuarioGerenciado>> {
  const { pagina, limite, skip, take } = intervaloDe(filtro);
  const where: Prisma.usuarioWhereInput = {
    ...(filtro.perfil === undefined ? {} : { perfil: filtro.perfil }),
    ...(filtro.ativo === undefined ? {} : { ativo: filtro.ativo }),
    ...(filtro.busca
      ? {
          OR: [
            { nome: { contains: literalParaLike(filtro.busca), mode: "insensitive" } },
            { email: { contains: literalParaLike(filtro.busca), mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [dados, total] = await Promise.all([
    prisma.usuario.findMany({ where, select: SELECAO, orderBy: [{ nome: "asc" }, { id_usuario: "asc" }], skip, take }),
    prisma.usuario.count({ where }),
  ]);
  return { dados, pagina, limite, total };
}

export async function alterarNaTransacao(
  tx: Tx,
  atorId: number,
  alvoId: number,
  mudancas: MudancasUsuario,
): Promise<UsuarioGerenciado> {
  const administradores = await tx.$queryRaw<
    { id_usuario: number }[]
  >`SELECT id_usuario FROM usuario WHERE perfil = 'administrador' AND ativo FOR UPDATE`;
  const alvo = await tx.usuario.findUnique({ where: { id_usuario: alvoId }, select: SELECAO });
  if (!alvo) throw new HttpError(404, "NAO_ENCONTRADO", "Usuário não encontrado");
  if (mudancas.ativo === false && alvoId === atorId) {
    throw new HttpError(409, "AUTO_INATIVACAO", "O administrador não pode inativar a si mesmo");
  }
  const deixaDeSerAdministradorAtivo =
    alvo.perfil === "administrador" &&
    alvo.ativo &&
    (mudancas.ativo === false || (mudancas.perfil !== undefined && mudancas.perfil !== "administrador"));
  if (deixaDeSerAdministradorAtivo && administradores.every((a) => a.id_usuario === alvoId)) {
    throw new HttpError(409, "ULTIMO_ADMINISTRADOR", "O sistema não pode ficar sem administrador ativo");
  }
  return tx.usuario.update({ where: { id_usuario: alvoId }, data: mudancas, select: SELECAO });
}

export async function atualizarUsuario(
  contexto: ContextoDeEscrita,
  id: number,
  dados: { nome?: string; email?: string; perfil?: perfil_usuario; senha?: string },
): Promise<UsuarioGerenciado> {
  const { senha, ...resto } = dados;
  const mudancas: MudancasUsuario = { ...resto };
  if (senha !== undefined) mudancas.senha_hash = await bcrypt.hash(senha, CUSTO_BCRYPT);
  return executarComoUsuario(contexto, (tx) => alterarNaTransacao(tx, contexto.idUsuario, id, mudancas));
}

export function inativarUsuario(contexto: ContextoDeEscrita, id: number): Promise<UsuarioGerenciado> {
  return executarComoUsuario(contexto, (tx) => alterarNaTransacao(tx, contexto.idUsuario, id, { ativo: false }));
}
