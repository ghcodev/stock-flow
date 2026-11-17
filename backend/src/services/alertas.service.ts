import { prisma } from "../db.ts";
import { HttpError } from "../errors.ts";
import { Prisma } from "../generated/prisma/client.ts";
import { montarCsv } from "../csv.ts";
import { intervaloDe, type Pagina, type Paginacao } from "../validators/comuns.ts";

const DIAS_DE_ANTECEDENCIA = 30;

export type AlertaDeVencimento = {
  id_lote: number;
  numero_lote: string;
  data_validade: string;
  dias_restantes: number;
  quantidade: Prisma.Decimal;
  produto: string;
  unidade_medida: string;
  corredor: string;
  nivel: string;
  posicao: string;
};

export type EscopoDeAlertas = { idsDeProduto: number[] };

const JANELA = Prisma.sql`
  l.status_lote = 'ativo'
  AND l.data_validade >= hoje_operacional()
  AND l.data_validade <= hoje_operacional() + ${DIAS_DE_ANTECEDENCIA}::int`;

function restricao(escopo?: EscopoDeAlertas): Prisma.Sql {
  return escopo ? Prisma.sql`AND l.id_produto = ANY(${escopo.idsDeProduto}::int[])` : Prisma.empty;
}

function selecao(escopo?: EscopoDeAlertas): Prisma.Sql {
  return Prisma.sql`
    SELECT l.id_lote, l.numero_lote, to_char(l.data_validade, 'YYYY-MM-DD') AS data_validade,
           (l.data_validade - hoje_operacional())::int AS dias_restantes, l.quantidade,
           p.nome AS produto, p.unidade_medida, loc.corredor, loc.nivel, loc.posicao
    FROM lote l
    JOIN produto p ON p.id_produto = l.id_produto
    JOIN localizacao loc ON loc.id_localizacao = l.id_localizacao
    WHERE ${JANELA} ${restricao(escopo)}
    ORDER BY l.data_validade, l.id_lote`;
}

async function contar(escopo?: EscopoDeAlertas): Promise<number> {
  const [{ total }] = await prisma.$queryRaw<{ total: number }[]>(
    Prisma.sql`SELECT count(*)::int AS total FROM lote l WHERE ${JANELA} ${restricao(escopo)}`,
  );
  return total;
}

export async function listarAlertasDeVencimento(
  filtro: Paginacao,
  escopo?: EscopoDeAlertas,
): Promise<Pagina<AlertaDeVencimento>> {
  const { pagina, limite, skip, take } = intervaloDe(filtro);
  const dados = await prisma.$queryRaw<AlertaDeVencimento[]>(
    Prisma.sql`${selecao(escopo)} LIMIT ${take} OFFSET ${skip}`,
  );
  return { dados, pagina, limite, total: await contar(escopo) };
}

export const TETO_DA_EXPORTACAO = 10_000;

export type DependenciasDaExportacao = {
  contar: () => Promise<number>;
  buscar: (limite: number) => Promise<AlertaDeVencimento[]>;
};

export function dependenciasDaExportacao(escopo?: EscopoDeAlertas): DependenciasDaExportacao {
  return {
    contar: () => contar(escopo),
    buscar: (limite) => prisma.$queryRaw<AlertaDeVencimento[]>(Prisma.sql`${selecao(escopo)} LIMIT ${limite}`),
  };
}

function recusarPorTamanho(): HttpError {
  return new HttpError(
    422,
    "EXPORTACAO_MUITO_GRANDE",
    `A exportação excede o limite de ${TETO_DA_EXPORTACAO} linhas. Reduza o conjunto de alertas e tente novamente`,
  );
}

function* linhasDoCsv(alertas: AlertaDeVencimento[]): Generator<string[]> {
  for (const a of alertas) {
    yield [a.numero_lote, a.produto, a.data_validade, a.quantidade.toString(), a.unidade_medida, `${a.corredor}-${a.nivel}-${a.posicao}`];
  }
}

export function criarExportador(dependencias: DependenciasDaExportacao = dependenciasDaExportacao()): () => Promise<string> {
  return async () => {
    if ((await dependencias.contar()) > TETO_DA_EXPORTACAO) throw recusarPorTamanho();
    const alertas = await dependencias.buscar(TETO_DA_EXPORTACAO + 1);
    if (alertas.length > TETO_DA_EXPORTACAO) throw recusarPorTamanho();
    return montarCsv(["Número do lote", "Produto", "Validade", "Quantidade", "Unidade", "Localização"], linhasDoCsv(alertas));
  };
}

export const exportarAlertasDeVencimento = criarExportador();
