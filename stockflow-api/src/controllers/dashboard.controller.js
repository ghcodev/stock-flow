const pool = require('../config/database');

function toNumber(value) {
  return Number(value || 0);
}

function roundNumber(value, decimals) {
  return Number(toNumber(value).toFixed(decimals));
}

function pctChange(today, average) {
  if (!average) return today ? 100 : 0;
  return roundNumber(((today - average) / average) * 100, 1);
}

function trendDirection(pct) {
  if (Math.abs(pct) < 2) return 'stable';
  return pct > 0 ? 'up' : 'down';
}

function healthMeta(score) {
  if (score >= 90) return { label: 'EXCELENTE', cor: 'success' };
  if (score >= 70) return { label: 'BOM', cor: 'info' };
  if (score >= 50) return { label: 'ATENÇÃO', cor: 'warning' };
  return { label: 'CRÍTICO', cor: 'danger' };
}

async function loteHasColumn(columnName) {
  const [[row]] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'lote'
       AND COLUMN_NAME = ?`,
    [columnName]
  );
  return toNumber(row.total) > 0;
}

async function kpis(req, res) {
  const VALID_PERIODS = ['hoje', 'semana', 'mes'];
  const periodo = VALID_PERIODS.includes(req.query.periodo) ? req.query.periodo : 'hoje';
  const dias = { hoje: 1, semana: 7, mes: 30 }[periodo];
  const currFilter = periodo === 'hoje'
    ? "DATE(data_movimentacao) = CURDATE()"
    : `data_movimentacao >= DATE_SUB(CURDATE(), INTERVAL ${dias} DAY)`;
  const prevFilter = periodo === 'hoje'
    ? "DATE(data_movimentacao) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
    : `data_movimentacao >= DATE_SUB(CURDATE(), INTERVAL ${dias * 2} DAY) AND data_movimentacao < DATE_SUB(CURDATE(), INTERVAL ${dias} DAY)`;

  const [[{ total_produtos }]] = await pool.execute("SELECT COUNT(*) AS total_produtos FROM produto WHERE ativo = 1");

  const [[{ lotes_bloqueados }]] = await pool.execute("SELECT COUNT(*) AS lotes_bloqueados FROM lote WHERE status_lote = 'bloqueado'");

  const [[{ lotes_vencendo }]] = await pool.execute(
    "SELECT COUNT(*) AS lotes_vencendo FROM lote WHERE status_lote = 'ativo' AND data_validade IS NOT NULL AND data_validade <= DATE_ADD(NOW(), INTERVAL 30 DAY)"
  );

  const [[{ movimentacoes_hoje }]] = await pool.execute(
    `SELECT COUNT(*) AS movimentacoes_hoje FROM movimentacao WHERE ${currFilter}`
  );

  const [[{ movimentacoes_ontem }]] = await pool.execute(
    `SELECT COUNT(*) AS movimentacoes_ontem FROM movimentacao WHERE ${prevFilter}`
  );

  const [[{ vencem_semana }]] = await pool.execute(
    `SELECT COUNT(*) AS vencem_semana
     FROM lote
     WHERE status_lote = 'ativo'
       AND data_validade IS NOT NULL
       AND data_validade BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)`
  );

  const [[{ vencem_mes }]] = await pool.execute(
    `SELECT COUNT(*) AS vencem_mes
     FROM lote
     WHERE status_lote = 'ativo'
       AND data_validade IS NOT NULL
       AND data_validade BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)`
  );

  const [[{ ultimo_bloqueio_dias }]] = await pool.execute(
    `SELECT DATEDIFF(NOW(), MAX(COALESCE(data_bloqueio, data_movimentacao))) AS ultimo_bloqueio_dias
     FROM lote
     LEFT JOIN movimentacao ON movimentacao.id_lote = lote.id
     WHERE lote.status_lote = 'bloqueado'`
  );

  const [sparkline] = await pool.execute(
    `SELECT DATE(data_movimentacao) AS dia, COUNT(*) AS total
     FROM movimentacao
     WHERE data_movimentacao >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(data_movimentacao)
     ORDER BY dia ASC`
  );

  const [abaixo] = await pool.execute(
    `SELECT COUNT(*) AS lotes_abaixo_minimo FROM (
       SELECT p.id, p.estoque_minimo, COALESCE(SUM(l.quantidade),0) AS estoque_atual
       FROM produto p
       LEFT JOIN lote l ON l.id_produto = p.id AND l.status_lote = 'ativo'
       WHERE p.ativo = 1
       GROUP BY p.id, p.estoque_minimo
       HAVING COUNT(l.id) > 0 AND estoque_atual < p.estoque_minimo
     ) AS sub`
  );

  const [[saudeFatores]] = await pool.execute(
    `SELECT
       SUM(CASE WHEN l.status_lote = 'ativo' AND l.quantidade < p.estoque_minimo THEN 1 ELSE 0 END) AS lotes_abaixo_minimo,
       SUM(CASE WHEN l.status_lote = 'ativo'
                  AND l.data_validade IS NOT NULL
                  AND l.data_validade BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 DAY)
                THEN 1 ELSE 0 END) AS lotes_vencendo_3d,
       SUM(CASE WHEN l.status_lote = 'bloqueado' THEN 1 ELSE 0 END) AS lotes_bloqueados
     FROM lote l
     JOIN produto p ON p.id = l.id_produto`
  );

  const rupturasScore = toNumber(saudeFatores.lotes_abaixo_minimo);
  const vencimentosScore = toNumber(saudeFatores.lotes_vencendo_3d);
  const bloqueiosScore = toNumber(saudeFatores.lotes_bloqueados);
  const score = Math.max(0, 100 - rupturasScore * 15 - vencimentosScore * 10 - bloqueiosScore * 8);
  const saude = healthMeta(score);

  let trendData;
  if (periodo === 'hoje') {
    trendData = await pool.execute(
      `WITH ref AS (
         SELECT COALESCE(MAX(DATE(data_movimentacao)), CURDATE()) AS dia
         FROM movimentacao
         WHERE DATE(data_movimentacao) <= CURDATE()
       )
       SELECT
         COUNT(CASE WHEN m.tipo = 'entrada' AND DATE(m.data_movimentacao) = ref.dia THEN 1 END) AS entradas_hoje,
         COUNT(CASE WHEN m.tipo = 'saida' AND DATE(m.data_movimentacao) = ref.dia THEN 1 END) AS saidas_hoje,
         COALESCE(AVG(CASE WHEN DATE(m.data_movimentacao) < ref.dia THEN CASE WHEN m.tipo = 'entrada' THEN 1 ELSE 0 END END), 0) AS entradas_media7d,
         COALESCE(AVG(CASE WHEN DATE(m.data_movimentacao) < ref.dia THEN CASE WHEN m.tipo = 'saida' THEN 1 ELSE 0 END END), 0) AS saidas_media7d
       FROM ref
       LEFT JOIN movimentacao m
         ON m.data_movimentacao >= DATE_SUB(ref.dia, INTERVAL 7 DAY)
        AND DATE(m.data_movimentacao) <= ref.dia`
    );
  } else {
    trendData = await pool.execute(
      `SELECT
         COUNT(CASE WHEN tipo = 'entrada' AND ${currFilter} THEN 1 END) AS entradas_hoje,
         COUNT(CASE WHEN tipo = 'saida' AND ${currFilter} THEN 1 END) AS saidas_hoje,
         COUNT(CASE WHEN tipo = 'entrada' AND ${prevFilter} THEN 1 END) AS entradas_media7d,
         COUNT(CASE WHEN tipo = 'saida' AND ${prevFilter} THEN 1 END) AS saidas_media7d
       FROM movimentacao
       WHERE data_movimentacao >= DATE_SUB(CURDATE(), INTERVAL ${dias * 2} DAY)`
    );
  }
  const [[trendRows]] = trendData;

  const entradasHoje = toNumber(trendRows.entradas_hoje);
  const entradasMedia7d = roundNumber(trendRows.entradas_media7d, 2);
  const entradasPct = pctChange(entradasHoje, entradasMedia7d);
  const saidasHoje = toNumber(trendRows.saidas_hoje);
  const saidasMedia7d = roundNumber(trendRows.saidas_media7d, 2);
  const saidasPct = pctChange(saidasHoje, saidasMedia7d);

  let capital = {
    capital_imobilizado: 0,
    capital_parado: 0,
  };

  if (await loteHasColumn('custo_unitario')) {
    const [[capitalRows]] = await pool.execute(
      `SELECT
         COALESCE(ROUND(SUM(CASE WHEN l.status_lote = 'ativo'
                                 THEN l.quantidade * COALESCE(l.custo_unitario, 0)
                                 ELSE 0 END), 2), 0) AS capital_imobilizado,
         COALESCE(ROUND(SUM(CASE WHEN l.status_lote = 'ativo'
                                  AND NOT EXISTS (
                                    SELECT 1
                                    FROM movimentacao m
                                    WHERE m.id_lote = l.id
                                      AND m.data_movimentacao >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                                  )
                                 THEN l.quantidade * COALESCE(l.custo_unitario, 0)
                                 ELSE 0 END), 2), 0) AS capital_parado
       FROM lote l`
    );

    capital = {
      capital_imobilizado: roundNumber(capitalRows.capital_imobilizado, 2),
      capital_parado: roundNumber(capitalRows.capital_parado, 2),
    };
  }

  let topData;
  if (periodo === 'hoje') {
    topData = await pool.execute(
      `WITH ref AS (
         SELECT COALESCE(MAX(DATE(data_movimentacao)), CURDATE()) AS dia
         FROM movimentacao
         WHERE DATE(data_movimentacao) <= CURDATE()
       )
       SELECT u.nome, COUNT(m.id) AS total
       FROM ref
       JOIN movimentacao m ON DATE(m.data_movimentacao) = ref.dia
       JOIN usuario u ON m.id_usuario = u.id
       GROUP BY u.id, u.nome
       ORDER BY total DESC
       LIMIT 3`
    );
  } else {
    topData = await pool.execute(
      `SELECT u.nome, COUNT(m.id) AS total
       FROM movimentacao m
       JOIN usuario u ON m.id_usuario = u.id
       WHERE ${currFilter}
       GROUP BY u.id, u.nome
       ORDER BY total DESC
       LIMIT 3`
    );
  }
  const [topOperadoresRows] = topData;

  return res.json({
    total_produtos,
    lotes_abaixo_minimo: abaixo[0].lotes_abaixo_minimo,
    lotes_vencendo,
    vencem_semana,
    vencem_mes,
    lotes_bloqueados,
    movimentacoes_hoje,
    movimentacoes_ontem,
    ultimo_bloqueio_dias,
    sparkline_movimentacoes: sparkline,
    saude_operacional: {
      score,
      label: saude.label,
      cor: saude.cor,
      fatores: {
        rupturas: rupturasScore,
        vencimentos: vencimentosScore,
        bloqueios: bloqueiosScore,
        giro: movimentacoes_hoje,
      },
    },
    tendencias: {
      entradas_hoje: entradasHoje,
      entradas_media7d: entradasMedia7d,
      entradas_pct: entradasPct,
      direcao_entradas: trendDirection(entradasPct),
      saidas_hoje: saidasHoje,
      saidas_media7d: saidasMedia7d,
      saidas_pct: saidasPct,
      direcao_saidas: trendDirection(saidasPct),
    },
    capital,
    top_operadores: topOperadoresRows.map((row, index) => ({
      posicao: index + 1,
      nome: row.nome,
      total_movimentacoes: toNumber(row.total),
    })),
  });
}

async function movimentacoes(req, res) {
  const VALID_PERIODS = ['hoje', 'semana', 'mes'];
  const periodo = VALID_PERIODS.includes(req.query.periodo) ? req.query.periodo : 'mes';
  const dias = { hoje: 1, semana: 7, mes: 60 }[periodo];

  const [rows] = await pool.execute(
    `SELECT
       DATE(data_movimentacao) AS dia,
       SUM(CASE WHEN tipo = 'entrada'       THEN quantidade ELSE 0 END) AS entradas,
       SUM(CASE WHEN tipo = 'saida'         THEN quantidade ELSE 0 END) AS saidas,
       SUM(CASE WHEN tipo = 'transferencia' THEN quantidade ELSE 0 END) AS transferencias,
       SUM(CASE WHEN tipo = 'ajuste'        THEN quantidade ELSE 0 END) AS ajustes
     FROM movimentacao
     WHERE data_movimentacao >= DATE_SUB(NOW(), INTERVAL ${dias} DAY)
     GROUP BY DATE(data_movimentacao)
     ORDER BY dia ASC`
  );
  return res.json(rows);
}

async function alertas(req, res) {
  const [vencendo] = await pool.execute(
    `SELECT 'vencendo' AS tipo_alerta, l.id, l.numero_lote, p.nome AS produto,
            DATEDIFF(l.data_validade, NOW()) AS dias_para_vencer
     FROM lote l JOIN produto p ON p.id = l.id_produto
     WHERE l.status_lote = 'ativo' AND l.data_validade IS NOT NULL
       AND l.data_validade <= DATE_ADD(NOW(), INTERVAL 30 DAY)
     ORDER BY l.data_validade ASC LIMIT 10`
  );

  const [abaixo] = await pool.execute(
    `SELECT 'abaixo_minimo' AS tipo_alerta, p.id, p.nome AS produto,
            p.estoque_minimo, COALESCE(SUM(l.quantidade),0) AS estoque_atual
     FROM produto p LEFT JOIN lote l ON l.id_produto = p.id AND l.status_lote = 'ativo'
     WHERE p.ativo = 1 GROUP BY p.id
     HAVING estoque_atual < p.estoque_minimo LIMIT 10`
  );

  const [bloqueados] = await pool.execute(
    `SELECT 'bloqueado' AS tipo_alerta, l.id, l.numero_lote, p.nome AS produto, l.motivo_bloqueio
     FROM lote l JOIN produto p ON p.id = l.id_produto
     WHERE l.status_lote = 'bloqueado' LIMIT 10`
  );

  return res.json({ alertas: [...vencendo, ...abaixo, ...bloqueados], total: vencendo.length + abaixo.length + bloqueados.length });
}

async function alertasPendentes(req, res) {
  const [rows] = await pool.execute(
    `SELECT
       CASE
         WHEN l.status_lote = 'bloqueado' THEN 'bloqueado'
         WHEN l.data_validade IS NOT NULL AND DATEDIFF(l.data_validade, NOW()) <= 3 THEN 'urgente'
         WHEN l.data_validade IS NOT NULL AND DATEDIFF(l.data_validade, NOW()) <= 15 THEN 'atencao'
         WHEN l.quantidade < p.estoque_minimo THEN 'estoque'
         ELSE 'vencimento'
       END AS tipo,
       l.numero_lote AS lote,
       p.nome AS produto,
       DATEDIFF(l.data_validade, NOW()) AS dias,
       l.quantidade,
       p.estoque_minimo,
       l.status_lote AS status,
       DATEDIFF(NOW(), COALESCE(l.data_bloqueio, l.data_fabricacao, NOW())) AS dias_bloqueado
     FROM lote l
     JOIN produto p ON p.id = l.id_produto
     WHERE (
       (l.data_validade IS NOT NULL AND l.data_validade <= DATE_ADD(NOW(), INTERVAL 30 DAY))
       OR l.status_lote = 'bloqueado'
       OR l.quantidade < p.estoque_minimo
     )
     AND l.status_lote <> 'finalizado'
     ORDER BY
       CASE
         WHEN l.status_lote = 'bloqueado' THEN 1
         WHEN l.data_validade IS NOT NULL AND DATEDIFF(l.data_validade, NOW()) <= 3 THEN 2
         WHEN l.quantidade < p.estoque_minimo THEN 3
         ELSE 4
       END,
       l.data_validade ASC
     LIMIT 30`
  );

  return res.json({ total: rows.length, itens: rows });
}

async function ocupacaoCorredores(req, res) {
  const [rows] = await pool.execute(
    `SELECT
       CONCAT(LEFT(loc.corredor, 2), '-', SUBSTRING(loc.corredor, 3, 2)) AS zona,
       COUNT(*) AS total_posicoes,
       SUM(CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END) AS ocupadas,
       ROUND(SUM(CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) AS percentual
     FROM localizacao loc
     LEFT JOIN lote l ON l.id_localizacao = loc.id AND l.status_lote = 'ativo'
     GROUP BY CONCAT(LEFT(loc.corredor, 2), '-', SUBSTRING(loc.corredor, 3, 2))
     ORDER BY zona`
  );

  const totalPosicoes = rows.reduce((acc, row) => acc + Number(row.total_posicoes || 0), 0);
  const ocupadas = rows.reduce((acc, row) => acc + Number(row.ocupadas || 0), 0);
  const percentual = totalPosicoes ? Number(((ocupadas / totalPosicoes) * 100).toFixed(1)) : 0;

  return res.json({ total_posicoes: totalPosicoes, ocupadas, percentual, corredores: rows });
}

async function topProdutos(req, res) {
  const periodo = req.query.periodo === 'semana' ? 7 : 30;
  const [rows] = await pool.execute(
    `SELECT p.nome, p.categoria, SUM(m.quantidade) AS total_movimentado
     FROM movimentacao m
     JOIN lote l ON m.id_lote = l.id
     JOIN produto p ON l.id_produto = p.id
     WHERE m.data_movimentacao >= DATE_SUB(NOW(), INTERVAL ${periodo} DAY)
     GROUP BY p.id, p.nome, p.categoria
     ORDER BY total_movimentado DESC
     LIMIT 5`
  );
  return res.json(rows);
}

async function operadoresHoje(req, res) {
  const [rows] = await pool.execute(
    `SELECT u.nome, u.perfil,
       COUNT(m.id) AS total_hoje,
       MAX(m.data_movimentacao) AS ultima_atividade
     FROM usuario u
     LEFT JOIN movimentacao m ON m.id_usuario = u.id
       AND DATE(m.data_movimentacao) = CURDATE()
     WHERE u.ativo = TRUE
     GROUP BY u.id, u.nome, u.perfil
     ORDER BY total_hoje DESC, ultima_atividade DESC`
  );
  return res.json(rows);
}

async function saudeEstoque(req, res) {
  const [[row]] = await pool.execute(
    `SELECT
       COALESCE(ROUND(AVG(DATEDIFF(data_validade, NOW())), 0), 0) AS media_dias,
       SUM(CASE WHEN DATEDIFF(data_validade,NOW()) > 90 THEN 1 ELSE 0 END) AS saudaveis,
       SUM(CASE WHEN DATEDIFF(data_validade,NOW()) BETWEEN 30 AND 90 THEN 1 ELSE 0 END) AS atencao,
       SUM(CASE WHEN DATEDIFF(data_validade,NOW()) < 30 THEN 1 ELSE 0 END) AS criticos
     FROM lote
     WHERE status_lote = 'ativo' AND data_validade IS NOT NULL`
  );
  return res.json(row || { media_dias: 0, saudaveis: 0, atencao: 0, criticos: 0 });
}

async function rupturas(req, res) {
  const [rows] = await pool.execute(
    `WITH consumo_diario AS (
       SELECT
         l2.id_produto,
         DATE(m2.data_movimentacao) AS dia,
         SUM(m2.quantidade) AS total
       FROM movimentacao m2
       JOIN lote l2 ON l2.id = m2.id_lote
       WHERE m2.tipo = 'saida'
         AND m2.data_movimentacao >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY l2.id_produto, DATE(m2.data_movimentacao)
     ),
     consumo_medio AS (
       SELECT id_produto, AVG(total) AS media_saida_diaria
       FROM consumo_diario
       GROUP BY id_produto
     )
     SELECT
       p.nome AS nome_produto,
       p.unidade_medida AS unidade,
       SUM(l.quantidade) AS estoque_atual,
       COALESCE(SUM(l.quantidade) / NULLIF(cm.media_saida_diaria, 0), 999) AS dias_para_ruptura
     FROM produto p
     JOIN lote l ON l.id_produto = p.id AND l.status_lote = 'ativo'
     LEFT JOIN consumo_medio cm ON cm.id_produto = p.id
     GROUP BY p.id, p.nome, p.unidade_medida, cm.media_saida_diaria
     HAVING dias_para_ruptura <= 30
     ORDER BY dias_para_ruptura ASC
     LIMIT 5`
  );

  return res.json(rows.map(row => ({
    nome_produto: row.nome_produto,
    unidade: row.unidade,
    estoque_atual: roundNumber(row.estoque_atual, 3),
    dias_para_ruptura: roundNumber(row.dias_para_ruptura, 1),
  })));
}

async function curvaAbc(req, res) {
  const [rows] = await pool.execute(
    `SELECT
       p.nome AS nome_produto,
       COUNT(m.id) AS total_mov
     FROM movimentacao m
     JOIN lote l ON l.id = m.id_lote
     JOIN produto p ON p.id = l.id_produto
     WHERE m.data_movimentacao >= DATE_SUB(NOW(), INTERVAL 90 DAY)
     GROUP BY p.id, p.nome
     ORDER BY total_mov DESC`
  );

  const totalMovimentacoes = rows.reduce((sum, row) => sum + toNumber(row.total_mov), 0);
  const resumoBase = {
    classe_a: { qtd_produtos: 0, pct_movimentacoes: 0 },
    classe_b: { qtd_produtos: 0, pct_movimentacoes: 0 },
    classe_c: { qtd_produtos: 0, pct_movimentacoes: 0 },
  };

  if (!totalMovimentacoes) {
    return res.json({ resumo: resumoBase, top10: [] });
  }

  let acumulado = 0;
  const totaisPorClasse = {
    A: 0,
    B: 0,
    C: 0,
  };

  const classificados = rows.map(row => {
    const totalMov = toNumber(row.total_mov);
    const pctAnterior = (acumulado / totalMovimentacoes) * 100;
    acumulado += totalMov;
    const pctAcumulado = (acumulado / totalMovimentacoes) * 100;
    let classe = 'C';

    if (pctAcumulado <= 80 || pctAnterior < 80) {
      classe = 'A';
    } else if (pctAcumulado <= 95 || pctAnterior < 95) {
      classe = 'B';
    }

    totaisPorClasse[classe] += totalMov;

    return {
      classe,
      nome_produto: row.nome_produto,
      total_mov: totalMov,
      pct_acumulado: roundNumber(pctAcumulado, 1),
    };
  });

  const resumo = {
    classe_a: {
      qtd_produtos: classificados.filter(item => item.classe === 'A').length,
      pct_movimentacoes: roundNumber((totaisPorClasse.A / totalMovimentacoes) * 100, 1),
    },
    classe_b: {
      qtd_produtos: classificados.filter(item => item.classe === 'B').length,
      pct_movimentacoes: roundNumber((totaisPorClasse.B / totalMovimentacoes) * 100, 1),
    },
    classe_c: {
      qtd_produtos: classificados.filter(item => item.classe === 'C').length,
      pct_movimentacoes: roundNumber((totaisPorClasse.C / totalMovimentacoes) * 100, 1),
    },
  };

  return res.json({ resumo, top10: classificados.slice(0, 10) });
}

module.exports = {
  kpis,
  movimentacoes,
  alertas,
  alertasPendentes,
  ocupacaoCorredores,
  topProdutos,
  operadoresHoje,
  saudeEstoque,
  rupturas,
  curvaAbc,
};
