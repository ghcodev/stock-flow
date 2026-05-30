const pool = require('../config/database');

async function kpis(req, res) {
  const [[{ total_produtos }]] = await pool.execute("SELECT COUNT(*) AS total_produtos FROM produto WHERE ativo = 1");

  const [[{ lotes_bloqueados }]] = await pool.execute("SELECT COUNT(*) AS lotes_bloqueados FROM lote WHERE status_lote = 'bloqueado'");

  const [[{ lotes_vencendo }]] = await pool.execute(
    "SELECT COUNT(*) AS lotes_vencendo FROM lote WHERE status_lote = 'ativo' AND data_validade IS NOT NULL AND data_validade <= DATE_ADD(NOW(), INTERVAL 30 DAY)"
  );

  const [[{ movimentacoes_hoje }]] = await pool.execute(
    "SELECT COUNT(*) AS movimentacoes_hoje FROM movimentacao WHERE DATE(data_movimentacao) = CURDATE()"
  );

  const [[{ movimentacoes_ontem }]] = await pool.execute(
    "SELECT COUNT(*) AS movimentacoes_ontem FROM movimentacao WHERE DATE(data_movimentacao) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
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
  });
}

async function movimentacoes(req, res) {
  const [rows] = await pool.execute(
    `SELECT
       DATE(data_movimentacao) AS dia,
       SUM(CASE WHEN tipo = 'entrada'       THEN quantidade ELSE 0 END) AS entradas,
       SUM(CASE WHEN tipo = 'saida'         THEN quantidade ELSE 0 END) AS saidas,
       SUM(CASE WHEN tipo = 'transferencia' THEN quantidade ELSE 0 END) AS transferencias,
       SUM(CASE WHEN tipo = 'ajuste'        THEN quantidade ELSE 0 END) AS ajustes
     FROM movimentacao
     WHERE data_movimentacao >= DATE_SUB(NOW(), INTERVAL 30 DAY)
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
       SUBSTRING_INDEX(loc.corredor, '-', 2) AS zona,
       COUNT(*) AS total_posicoes,
       SUM(CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END) AS ocupadas,
       ROUND(SUM(CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) AS percentual
     FROM localizacao loc
     LEFT JOIN lote l ON l.id_localizacao = loc.id AND l.status_lote = 'ativo'
     GROUP BY SUBSTRING_INDEX(loc.corredor, '-', 2)
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

module.exports = {
  kpis,
  movimentacoes,
  alertas,
  alertasPendentes,
  ocupacaoCorredores,
  topProdutos,
  operadoresHoje,
  saudeEstoque,
};
