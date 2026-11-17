import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/db.ts";
import { HttpError } from "../src/errors.ts";
import { alterarNaTransacao } from "../src/services/usuario.service.ts";
import { criarUsuarioTeste, desativarUsuariosTeste } from "./helpers.ts";

class Desfazer extends Error {}

const ISOLADO = process.env.STOCKFLOW_TESTE_ISOLADO === "1";

describe("último administrador ativo, com o estado global de administradores (A9)", () => {
  it(
    "não pode ser inativado nem rebaixado, e a transação desfeita restaura os administradores",
    { skip: ISOLADO ? false : "só roda no banco descartável (npm run test:isolado): desativa os demais administradores do banco dentro da transação" },
    async () => {
      const alvo = await criarUsuarioTeste("administrador");
      const antes = (await prisma.usuario.findMany({ where: { perfil: "administrador", ativo: true }, select: { id_usuario: true } })).map((u) => u.id_usuario);
      assert.ok(antes.includes(alvo.id));
      let resultados: string[] = [];
      try {
        await assert.rejects(
          prisma.$transaction(async (tx) => {
            await tx.usuario.updateMany({
              where: { perfil: "administrador", ativo: true, id_usuario: { not: alvo.id } },
              data: { ativo: false },
            });
            for (const mudanca of [{ perfil: "operador" as const }, { ativo: false }]) {
              const erro = await alterarNaTransacao(tx, 0, alvo.id, mudanca).then(
                () => null,
                (e: unknown) => e,
              );
              assert.ok(erro instanceof HttpError);
              resultados = [...resultados, `${erro.status}:${erro.codigo}`];
            }
            throw new Desfazer("desfazer");
          }),
          Desfazer,
        );
        assert.deepEqual(resultados, ["409:ULTIMO_ADMINISTRADOR", "409:ULTIMO_ADMINISTRADOR"]);
        const depois = (await prisma.usuario.findMany({ where: { id_usuario: { in: antes } }, select: { id_usuario: true, ativo: true } })).filter((u) => u.ativo).map((u) => u.id_usuario);
        assert.deepEqual(depois.sort((a, b) => a - b), [...antes].sort((a, b) => a - b));
      } finally {
        await desativarUsuariosTeste();
        await prisma.$disconnect();
      }
    },
  );
});
