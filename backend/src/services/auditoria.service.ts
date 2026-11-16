import { prisma } from "../db.ts";
import { Prisma } from "../generated/prisma/client.ts";
import { lerFiltroJson, type ValorJson } from "../filtro-json.ts";
import { fimExclusivoDoPeriodo, inicioDoPeriodo, lerInstante } from "../periodo.ts";
import { intervaloDe, type Pagina, type Paginacao } from "../validators/comuns.ts";

export type FiltroAuditoria = Paginacao & {
  de?: string;
  ate?: string;
  id_usuario?: number;
  tabela?: string;
  operacao?: string;
  ip?: string;
  valor_novo?: string;
  valor_anterior?: string;
  antes_de_id?: string;
};

export type RegistroDeAuditoria = {
  id_log: string;
  tabela_afetada: string;
  operacao: string;
  valor_anterior: ValorJson | null;
  valor_novo: ValorJson | null;
  id_usuario: number | null;
  nome_usuario: string | null;
  data_hora: Date;
  ip_usuario: string | null;
  observacao: string | null;
};

export type PaginaDeAuditoria = Pagina<RegistroDeAuditoria> & { proximo_antes_de_id: string | null };

function semSenha(valor: ValorJson | null): ValorJson | null {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) return valor;
  const limpo: { [chave: string]: ValorJson } = {};
  for (const [chave, interno] of Object.entries(valor)) {
    if (chave !== "senha_hash") limpo[chave] = interno;
  }
  return limpo;
}

export function condicoesDaAuditoria(filtro: FiltroAuditoria): Prisma.Sql[] {
  const condicoes: Prisma.Sql[] = [];
  if (filtro.de !== undefined) {
    const instante = lerInstante(filtro.de);
    if (instante) condicoes.push(Prisma.sql`data_hora >= ${inicioDoPeriodo(instante)}`);
  }
  if (filtro.ate !== undefined) {
    const instante = lerInstante(filtro.ate);
    if (instante) condicoes.push(Prisma.sql`data_hora < ${fimExclusivoDoPeriodo(instante)}`);
  }
  if (filtro.id_usuario !== undefined) condicoes.push(Prisma.sql`id_usuario = ${filtro.id_usuario}`);
  if (filtro.tabela !== undefined) condicoes.push(Prisma.sql`tabela_afetada = ${filtro.tabela}`);
  if (filtro.operacao !== undefined) condicoes.push(Prisma.sql`operacao = ${filtro.operacao}::operacao_auditoria`);
  if (filtro.ip !== undefined) condicoes.push(Prisma.sql`ip_usuario = ${filtro.ip}::inet`);
  for (const [coluna, texto] of [
    ["valor_novo", filtro.valor_novo],
    ["valor_anterior", filtro.valor_anterior],
  ] as const) {
    if (texto === undefined) continue;
    const objeto = lerFiltroJson(texto);
    if (objeto) condicoes.push(Prisma.sql`${Prisma.raw(coluna)} @> ${JSON.stringify(objeto)}::jsonb`);
  }
  return condicoes;
}

function onde(condicoes: Prisma.Sql[]): Prisma.Sql {
  return condicoes.length === 0 ? Prisma.empty : Prisma.sql`WHERE ${Prisma.join(condicoes, " AND ")}`;
}

function condicoesComCursor(filtro: FiltroAuditoria): Prisma.Sql[] {
  const condicoes = condicoesDaAuditoria(filtro);
  if (filtro.antes_de_id !== undefined) condicoes.push(Prisma.sql`id_log < ${BigInt(filtro.antes_de_id)}`);
  return condicoes;
}

export function consultaDeAuditoria(filtro: FiltroAuditoria, skip: number, take: number): Prisma.Sql {
  const condicoes = condicoesComCursor(filtro);
  return Prisma.sql`
    SELECT id_log::text AS id_log, tabela_afetada, operacao::text AS operacao, valor_anterior, valor_novo,
           id_usuario, (SELECT u.nome FROM usuario u WHERE u.id_usuario = auditoria_log.id_usuario) AS nome_usuario, data_hora, host(ip_usuario) AS ip_usuario, observacao
    FROM auditoria_log ${onde(condicoes)}
    ORDER BY auditoria_log.id_log DESC LIMIT ${take} OFFSET ${skip}`;
}

export async function listarAuditoria(filtro: FiltroAuditoria): Promise<PaginaDeAuditoria> {
  const { pagina, limite, skip, take } = intervaloDe(filtro);
  const linhas = await prisma.$queryRaw<RegistroDeAuditoria[]>(consultaDeAuditoria(filtro, skip, take));
  const [{ total }] = await prisma.$queryRaw<{ total: bigint }[]>(
    Prisma.sql`SELECT count(*) AS total FROM auditoria_log ${onde(condicoesComCursor(filtro))}`,
  );
  const dados = linhas.map((linha) => ({
    ...linha,
    valor_anterior: semSenha(linha.valor_anterior),
    valor_novo: semSenha(linha.valor_novo),
  }));
  const totalNumero = Number(total);
  const haMais = skip + dados.length < totalNumero;
  return {
    dados,
    pagina,
    limite,
    total: totalNumero,
    proximo_antes_de_id: haMais ? (dados.at(-1)?.id_log ?? null) : null,
  };
}
