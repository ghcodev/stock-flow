const pool = require('../config/database');

async function listar(req, res) {
  const { operacao = '', tabela = '', usuario = '', page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  const conds = [];
  if (operacao) { conds.push('a.operacao = ?'); params.push(operacao); }
  if (tabela) { conds.push('a.tabela_afetada = ?'); params.push(tabela); }
  if (usuario) { conds.push('a.id_usuario = ?'); params.push(usuario); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const [rows] = await pool.execute(
    `SELECT a.*,
            a.data_hora AS criado_em,
            a.operacao AS acao,
            a.tabela_afetada AS entidade,
            COALESCE(a.observacao, a.valor_novo, a.valor_anterior) AS detalhe,
            a.ip_usuario AS ip,
            SHA2(CONCAT(a.id, '|', a.tabela_afetada, '|', a.operacao, '|', COALESCE(a.valor_novo, '')), 256) AS hash,
            u.nome AS usuario_nome,
            u.email AS usuario_email
     FROM auditoria_log a LEFT JOIN usuario u ON u.id = a.id_usuario
     ${where} ORDER BY a.data_hora DESC LIMIT ${Number(limit)} OFFSET ${offset}`,
    params
  );
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM auditoria_log a ${where}`, params);
  return res.json({ data: rows, total, page: Number(page), limit: Number(limit) });
}

async function porLote(req, res) {
  const [rows] = await pool.execute(
    `SELECT a.*, u.nome AS usuario_nome
     FROM auditoria_log a LEFT JOIN usuario u ON u.id = a.id_usuario
     WHERE a.tabela_afetada IN ('lote','movimentacao')
       AND (a.valor_novo LIKE ? OR a.valor_anterior LIKE ?)
     ORDER BY a.data_hora DESC`,
    [`%lote:${req.params.id}%`, `%lote:${req.params.id}%`]
  );
  return res.json(rows);
}

async function porUsuario(req, res) {
  const [rows] = await pool.execute(
    `SELECT a.* FROM auditoria_log a WHERE a.id_usuario = ? ORDER BY a.data_hora DESC LIMIT 200`,
    [req.params.id]
  );
  return res.json(rows);
}

module.exports = { listar, porLote, porUsuario };
