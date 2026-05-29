const { validationResult } = require('express-validator');
const pool = require('../config/database');
const logAudit = require('../middleware/audit');

async function listar(req, res) {
  const { status = '', produto = '', page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  const conds = [];
  if (status) { conds.push('l.status_lote = ?'); params.push(status); }
  if (produto) { conds.push('l.id_produto = ?'); params.push(produto); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const [rows] = await pool.execute(
    `SELECT l.*,
            l.numero_lote AS codigo,
            l.status_lote AS status,
            DATEDIFF(l.data_validade, NOW()) AS dias_para_vencer,
            p.nome AS produto_nome,
            loc.corredor, loc.nivel, loc.posicao,
            i.codigo AS rfid,
            i.codigo AS codigo_identificacao
     FROM lote l
     JOIN produto p ON p.id = l.id_produto
     JOIN localizacao loc ON loc.id = l.id_localizacao
     LEFT JOIN identificacao i ON i.id_lote = l.id
     ${where} ORDER BY l.criado_em DESC LIMIT ${Number(limit)} OFFSET ${offset}`,
    params
  );
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM lote l ${where}`, params);
  return res.json({ data: rows, total, page: Number(page), limit: Number(limit) });
}

async function buscarPorId(req, res) {
  const [rows] = await pool.execute(
    `SELECT l.*,
            l.numero_lote AS codigo,
            l.status_lote AS status,
            p.nome AS produto_nome,
            loc.corredor, loc.nivel, loc.posicao,
            i.tipo AS identificacao_tipo,
            i.codigo AS identificacao_codigo,
            i.codigo AS rfid
     FROM lote l
     JOIN produto p ON p.id = l.id_produto
     JOIN localizacao loc ON loc.id = l.id_localizacao
     LEFT JOIN identificacao i ON i.id_lote = l.id
     WHERE l.id = ?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Lote não encontrado' });
  return res.json(rows[0]);
}

async function timeline(req, res) {
  const [rows] = await pool.execute(
    `SELECT m.*, u.nome AS usuario_nome,
            lo.corredor AS origem_corredor, lo.nivel AS origem_nivel,
            ld.corredor AS destino_corredor, ld.nivel AS destino_nivel
     FROM movimentacao m
     JOIN usuario u ON u.id = m.id_usuario
     LEFT JOIN localizacao lo ON lo.id = m.id_localizacao_origem
     LEFT JOIN localizacao ld ON ld.id = m.id_localizacao_destino
     WHERE m.id_lote = ?
     ORDER BY m.data_movimentacao DESC`,
    [req.params.id]
  );
  return res.json(rows);
}

async function vencendo(req, res) {
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
       AND l.data_validade <= DATE_ADD(NOW(), INTERVAL 30 DAY)
     ORDER BY l.data_validade ASC`
  );
  return res.json(rows);
}

async function abaixoMinimo(req, res) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.nome, p.estoque_minimo, p.unidade_medida,
            COALESCE(SUM(l.quantidade),0) AS estoque_atual
     FROM produto p
     LEFT JOIN lote l ON l.id_produto = p.id AND l.status_lote = 'ativo'
     WHERE p.ativo = 1
     GROUP BY p.id, p.nome, p.estoque_minimo, p.unidade_medida
     HAVING estoque_atual < p.estoque_minimo
     ORDER BY p.nome`
  );
  return res.json(rows);
}

async function criar(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { numero_lote, data_fabricacao, data_validade, quantidade = 0, id_produto, id_localizacao } = req.body;

  const [dup] = await pool.execute('SELECT id FROM lote WHERE numero_lote = ?', [numero_lote]);
  if (dup.length) return res.status(409).json({ error: 'Número de lote já cadastrado' });

  const cols = ['numero_lote', 'quantidade', 'id_produto', 'id_localizacao'];
  const vals = [numero_lote, quantidade, id_produto, id_localizacao];
  if (data_fabricacao) { cols.push('data_fabricacao'); vals.push(data_fabricacao); }
  if (data_validade)   { cols.push('data_validade');   vals.push(data_validade); }

  const [result] = await pool.execute(
    `INSERT INTO lote (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    vals
  );

  await logAudit({ tabela: 'lote', operacao: 'INSERT', valorNovo: `numero_lote:${numero_lote}`, idUsuario: req.user.id, ip: req.ip });
  return res.status(201).json({ id: result.insertId, numero_lote });
}

async function atualizar(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const [rows] = await pool.execute('SELECT * FROM lote WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Lote não encontrado' });

  const ant = rows[0];
  const { numero_lote, data_fabricacao, data_validade, id_localizacao } = req.body;

  await pool.execute(
    'UPDATE lote SET numero_lote=?, data_fabricacao=?, data_validade=?, id_localizacao=? WHERE id=?',
    [numero_lote ?? ant.numero_lote, data_fabricacao ?? ant.data_fabricacao,
     data_validade ?? ant.data_validade, id_localizacao ?? ant.id_localizacao, req.params.id]
  );

  await logAudit({ tabela: 'lote', operacao: 'UPDATE', valorAnterior: `numero_lote:${ant.numero_lote}`, valorNovo: `numero_lote:${numero_lote ?? ant.numero_lote}`, idUsuario: req.user.id, ip: req.ip });
  return res.json({ mensagem: 'Lote atualizado' });
}

async function bloquear(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const [rows] = await pool.execute('SELECT * FROM lote WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Lote não encontrado' });

  const { motivo } = req.body;
  await pool.execute(
    "UPDATE lote SET status_lote='bloqueado', data_bloqueio=NOW(), motivo_bloqueio=? WHERE id=?",
    [motivo, req.params.id]
  );

  await logAudit({
    tabela: 'lote', operacao: 'BLOQUEIO',
    valorAnterior: `status:${rows[0].status_lote}`,
    valorNovo: `status:bloqueado,motivo:${motivo}`,
    idUsuario: req.user.id, ip: req.ip,
  });
  return res.json({ mensagem: 'Lote bloqueado' });
}

async function desbloquear(req, res) {
  const [rows] = await pool.execute('SELECT * FROM lote WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Lote não encontrado' });

  await pool.execute(
    "UPDATE lote SET status_lote='ativo', data_bloqueio=NULL, motivo_bloqueio=NULL WHERE id=?",
    [req.params.id]
  );

  await logAudit({ tabela: 'lote', operacao: 'UPDATE', valorAnterior: `status:${rows[0].status_lote}`, valorNovo: 'status:ativo', idUsuario: req.user.id, ip: req.ip });
  return res.json({ mensagem: 'Lote desbloqueado' });
}

module.exports = { listar, buscarPorId, timeline, vencendo, abaixoMinimo, criar, atualizar, bloquear, desbloquear };
