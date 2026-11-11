const { validationResult } = require('express-validator');
const pool = require('../config/database');
const logAudit = require('../middleware/audit');

async function listar(req, res) {
  const { busca = '', categoria = '', page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const params = [`%${busca}%`];
  let where = 'WHERE (p.nome LIKE ? OR p.descricao LIKE ?)';
  params.push(`%${busca}%`);
  if (categoria) { where += ' AND p.categoria = ?'; params.push(categoria); }

  const [rows] = await pool.execute(
    `SELECT p.*, COALESCE(SUM(l.quantidade),0) AS estoque_atual
     FROM produto p LEFT JOIN lote l ON l.id_produto = p.id AND l.status_lote = 'ativo'
     ${where} GROUP BY p.id ORDER BY p.nome LIMIT ${Number(limit)} OFFSET ${offset}`,
    params
  );
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM produto p ${where}`,
    params
  );
  return res.json({ data: rows, total, page: Number(page), limit: Number(limit) });
}

async function buscarPorId(req, res) {
  const [rows] = await pool.execute(
    `SELECT p.*, COALESCE(SUM(l.quantidade),0) AS estoque_atual
     FROM produto p LEFT JOIN lote l ON l.id_produto = p.id AND l.status_lote = 'ativo'
     WHERE p.id = ? GROUP BY p.id`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
  return res.json(rows[0]);
}

async function criar(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { nome, categoria, descricao, unidade_medida, estoque_minimo = 0, tipo_armazenagem = 'seco', peso_unitario_kg = null } = req.body;

  const [dup] = await pool.execute('SELECT id FROM produto WHERE nome = ?', [nome]);
  if (dup.length) return res.status(409).json({ error: 'Já existe um produto com este nome' });

  const [result] = await pool.execute(
    'INSERT INTO produto (nome, categoria, descricao, unidade_medida, estoque_minimo, tipo_armazenagem, peso_unitario_kg) VALUES (?,?,?,?,?,?,?)',
    [nome, categoria, descricao || null, unidade_medida, estoque_minimo, tipo_armazenagem, peso_unitario_kg]
  );

  await logAudit({ tabela: 'produto', operacao: 'INSERT', valorNovo: { nome, categoria, unidade_medida, tipo_armazenagem, peso_unitario_kg }, idUsuario: req.user.id, ip: req.ip });
  return res.status(201).json({ id: result.insertId, nome, categoria, unidade_medida, estoque_minimo, tipo_armazenagem, peso_unitario_kg });
}

async function atualizar(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const [rows] = await pool.execute('SELECT * FROM produto WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });

  const { nome, categoria, descricao, unidade_medida, estoque_minimo, tipo_armazenagem, peso_unitario_kg } = req.body;
  const anterior = rows[0];
  const tipoArmazenagem = tipo_armazenagem ?? anterior.tipo_armazenagem;
  const pesoUnitario = peso_unitario_kg === undefined ? anterior.peso_unitario_kg : peso_unitario_kg;

  await pool.execute(
    'UPDATE produto SET nome=?, categoria=?, descricao=?, unidade_medida=?, estoque_minimo=?, tipo_armazenagem=?, peso_unitario_kg=? WHERE id=?',
    [nome ?? anterior.nome, categoria ?? anterior.categoria, descricao ?? anterior.descricao,
     unidade_medida ?? anterior.unidade_medida, estoque_minimo ?? anterior.estoque_minimo, tipoArmazenagem, pesoUnitario, req.params.id]
  );

  await logAudit({
    tabela: 'produto', operacao: 'UPDATE',
    valorAnterior: { nome: anterior.nome, tipo_armazenagem: anterior.tipo_armazenagem, peso_unitario_kg: anterior.peso_unitario_kg },
    valorNovo: { nome: nome ?? anterior.nome, categoria: categoria ?? anterior.categoria, tipo_armazenagem: tipoArmazenagem, peso_unitario_kg: pesoUnitario },
    idUsuario: req.user.id, ip: req.ip,
  });
  return res.json({ mensagem: 'Produto atualizado' });
}

async function inativar(req, res) {
  const [rows] = await pool.execute('SELECT id, nome FROM produto WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });

  await pool.execute('UPDATE produto SET ativo = 0 WHERE id = ?', [req.params.id]);
  await logAudit({ tabela: 'produto', operacao: 'UPDATE', valorNovo: { produto: rows[0].nome, ativo: false }, idUsuario: req.user.id, ip: req.ip });
  return res.json({ mensagem: 'Produto inativado' });
}

module.exports = { listar, buscarPorId, criar, atualizar, inativar };
