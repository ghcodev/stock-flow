import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { prisma } from "../src/db.ts";
import { chamarApi } from "./api.ts";
import { criarUsuarioTeste, tokenDe, type Servidor, type UsuarioTeste } from "./helpers.ts";

export type Mov = {
  id_movimentacao: string;
  tipo_movimentacao: string;
  quantidade: string;
  saldo_anterior: string;
  saldo_posterior: string;
  id_lote: number;
  id_usuario: number;
  id_localizacao_origem: number | null;
  id_localizacao_destino: number | null;
  motivo_movimentacao: string | null;
  observacao: string | null;
  status_movimentacao: string;
  data_movimentacao: string;
};

export type Cenario = {
  prefixo: string;
  operadorUsuario: UsuarioTeste;
  operador: string;
  adminUsuario: UsuarioTeste;
  admin: string;
  idProduto: number;
  idLocalizacao: number;
  idOutraLocalizacao: number;
  novoLote: (sufixo: string, extra?: Record<string, unknown>) => Promise<number>;
  saldoDo: (idLote: number) => Promise<string>;
  movimentos: (idLote: number) => Promise<Awaited<ReturnType<typeof prisma.movimentacao.findMany>>>;
  verificarInvariante: (idLote: number) => Promise<void>;
  encerrar: () => Promise<void>;
};

export async function montarCenario(servidor: Servidor, rotulo: string): Promise<Cenario> {
  const prefixo = `${rotulo}${randomUUID().slice(0, 8)}`;
  const operadorUsuario = await criarUsuarioTeste("operador");
  const operador = await tokenDe(operadorUsuario);
  const adminUsuario = await criarUsuarioTeste("administrador");
  const admin = await tokenDe(adminUsuario);
  const idProduto = (await prisma.produto.create({ data: { nome: `${prefixo}-prod`, unidade_medida: "UN" } })).id_produto;
  const idLocalizacao = (await prisma.localizacao.create({ data: { corredor: prefixo, nivel: "1", posicao: "A" } }))
    .id_localizacao;
  const idOutraLocalizacao = (await prisma.localizacao.create({ data: { corredor: prefixo, nivel: "1", posicao: "B" } }))
    .id_localizacao;

  const novoLote = async (sufixo: string, extra: Record<string, unknown> = {}): Promise<number> => {
    const r = await chamarApi(servidor, "POST", "/lotes", operador, {
      numero_lote: `${prefixo}-${sufixo}`,
      id_produto: idProduto,
      id_localizacao: idLocalizacao,
      ...extra,
    });
    assert.equal(r.status, 201, r.texto);
    return (r.corpo as { id_lote: number }).id_lote;
  };
  const saldoDo = async (idLote: number): Promise<string> =>
    (await prisma.lote.findUniqueOrThrow({ where: { id_lote: idLote } })).quantidade.toString();
  const movimentos = (idLote: number) =>
    prisma.movimentacao.findMany({ where: { id_lote: idLote }, orderBy: [{ data_movimentacao: "asc" }, { id_movimentacao: "asc" }] });
  const verificarInvariante = async (idLote: number): Promise<void> => {
    const lista = (await movimentos(idLote)).filter(
      (m) => m.tipo_movimentacao !== "inventario" && m.status_movimentacao === "concluida",
    );
    assert.ok(lista.length > 0, "lote sem movimentações que alteram saldo");
    assert.equal(lista.at(-1)?.saldo_posterior.toString(), await saldoDo(idLote), "saldo do lote difere da última movimentação");
    for (let i = 1; i < lista.length; i++) {
      assert.equal(lista[i]?.saldo_anterior.toString(), lista[i - 1]?.saldo_posterior.toString(), `buraco na posição ${i}`);
    }
  };
  const encerrar = async (): Promise<void> => {
    await prisma.produto.updateMany({ where: { nome: { startsWith: prefixo } }, data: { ativo: false } });
  };

  return {
    prefixo,
    operadorUsuario,
    operador,
    adminUsuario,
    admin,
    idProduto,
    idLocalizacao,
    idOutraLocalizacao,
    novoLote,
    saldoDo,
    movimentos,
    verificarInvariante,
    encerrar,
  };
}
