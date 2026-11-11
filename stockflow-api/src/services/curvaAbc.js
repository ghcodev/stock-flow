const pool = require('../config/database');

async function carregarCurvaAbc() {
  const [rows] = await pool.execute(
    `SELECT
       p.id AS id_produto,
       p.nome AS nome_produto,
       COUNT(m.id) AS total_mov
     FROM movimentacao m
     JOIN lote l ON l.id = m.id_lote
     JOIN produto p ON p.id = l.id_produto
     WHERE m.data_movimentacao >= DATE_SUB(NOW(), INTERVAL 90 DAY)
     GROUP BY p.id, p.nome
     ORDER BY total_mov DESC`
  );

  const totalMovimentacoes = rows.reduce((sum, row) => sum + Number(row.total_mov), 0);
  let acumulado = 0;

  return rows.map(row => {
    const totalMov = Number(row.total_mov);
    const pctAnterior = (acumulado / totalMovimentacoes) * 100;
    acumulado += totalMov;
    const pctAcumulado = (acumulado / totalMovimentacoes) * 100;
    let classe = 'C';

    if (pctAcumulado <= 80 || pctAnterior < 80) {
      classe = 'A';
    } else if (pctAcumulado <= 95 || pctAnterior < 95) {
      classe = 'B';
    }

    return {
      id_produto: row.id_produto,
      classe,
      nome_produto: row.nome_produto,
      total_mov: totalMov,
      pct_acumulado: Number(pctAcumulado.toFixed(1)),
    };
  });
}

module.exports = carregarCurvaAbc;
