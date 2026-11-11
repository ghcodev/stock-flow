async function listarLotesVencendo(dias) {
  const pool = require('../config/database');
  const [rows] = await pool.execute(
    `SELECT l.*,
            l.numero_lote AS codigo,
            l.status_lote AS status,
            p.nome AS produto_nome,
            loc.corredor, loc.nivel, loc.posicao,
            DATEDIFF(l.data_validade, NOW()) AS dias_para_vencer
     FROM lote l
     JOIN produto p ON p.id = l.id_produto
     JOIN localizacao loc ON loc.id = l.id_localizacao
     WHERE l.status_lote = 'ativo' AND l.data_validade IS NOT NULL
       AND l.data_validade <= DATE_ADD(NOW(), INTERVAL ? DAY)
     ORDER BY l.data_validade ASC`,
    [dias]
  );
  return rows;
}

module.exports = { listarLotesVencendo };
