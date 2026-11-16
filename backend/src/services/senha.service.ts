import bcrypt from "bcrypt";
import { prisma } from "../db.ts";
import { HttpError } from "../errors.ts";
import { executarComoUsuario, type ContextoDeEscrita } from "../transacao.ts";
import { HASH_RESERVA } from "./auth.service.ts";
import { CUSTO_BCRYPT } from "./usuario.service.ts";

export async function trocarSenha(contexto: ContextoDeEscrita, senhaAtual: string, novaSenha: string): Promise<void> {
  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario: contexto.idUsuario },
    select: { senha_hash: true },
  });
  const confere = await bcrypt.compare(senhaAtual, usuario?.senha_hash ?? HASH_RESERVA);
  if (!usuario || !confere) {
    throw new HttpError(422, "SENHA_ATUAL_INCORRETA", "Senha atual incorreta");
  }
  const senhaHash = await bcrypt.hash(novaSenha, CUSTO_BCRYPT);
  await executarComoUsuario(contexto, (tx) =>
    tx.usuario.update({ where: { id_usuario: contexto.idUsuario }, data: { senha_hash: senhaHash }, select: { id_usuario: true } }),
  );
}
