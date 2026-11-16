import { prisma } from "../db.ts";
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

const SELECAO = Prisma.sql`
  SELECT l.id_lote, l.numero_lote, to_char(l.data_validade, 'YYYY-MM-DD') AS data_validade,
         (l.data_validade - current_date)::int AS dias_restantes, l.quantidade,
         p.nome AS produto, p.unidade_medida, loc.corredor, loc.nivel, loc.posicao
  FROM lote l
  JOIN produto p ON p.id_produto = l.id_produto
  JOIN localizacao loc ON loc.id_localizacao = l.id_localizacao
  WHERE l.status_lote = 'ativo'
    AND l.data_validade >= current_date
    AND l.data_validade <= current_date + ${DIAS_DE_ANTECEDENCIA}::int
  ORDER BY l.data_validade, l.id_lote`;

export async function listarAlertasDeVencimento(filtro: Paginacao): Promise<Pagina<AlertaDeVencimento>> {
  const { pagina, limite, skip, take } = intervaloDe(filtro);
  const dados = await prisma.$queryRaw<AlertaDeVencimento[]>(Prisma.sql`${SELECAO} LIMIT ${take} OFFSET ${skip}`);
  const [{ total }] = await prisma.$queryRaw<{ total: number }[]>`
    SELECT count(*)::int AS total FROM lote
    WHERE status_lote = 'ativo' AND data_validade >= current_date AND data_validade <= current_date + ${DIAS_DE_ANTECEDENCIA}::int`;
  return { dados, pagina, limite, total };
}

export async function exportarAlertasDeVencimento(): Promise<string> {
  const alertas = await prisma.$queryRaw<AlertaDeVencimento[]>(SELECAO);
  return montarCsv(
    ["Número do lote", "Produto", "Validade", "Quantidade", "Unidade", "Localização"],
    alertas.map((a) => [
      a.numero_lote,
      a.produto,
      a.data_validade,
      a.quantidade.toString(),
      a.unidade_medida,
      `${a.corredor}-${a.nivel}-${a.posicao}`,
    ]),
  );
}
