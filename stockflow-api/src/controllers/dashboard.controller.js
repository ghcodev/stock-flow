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

  const [abaixo] = await pool.execute(
    `SELECT COUNT(*) AS lotes_abaixo_minimo FROM (
       SELECT p.id, p.estoque_minimo, COALESCE(SUM(l.quantidade),0) AS estoque_atual
       FROM produto p
       LEFT JOIN lote l ON l.id_produto = p.id AND l.status_lote = 'ativo'
       WHERE p.ativo = 1
       GROUP BY p.id, p.estoque_minimo
       HAVING estoque_atual < p.estoque_minimo
     ) AS sub`
  );

  return res.json({
    total_produtos,
    lotes_abaixo_minimo: abaixo[0].lotes_abaixo_minimo,
    lotes_vencendo,
    lotes_bloqueados,
    movimentacoes_hoje,
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

module.exports = { kpis, movimentacoes, alertas };
