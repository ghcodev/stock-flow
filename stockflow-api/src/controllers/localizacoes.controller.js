const { validationResult } = require('express-validator');
const pool = require('../config/database');
const logAudit = require('../middleware/audit');
const { sugerirPosicoes } = require('../services/sugestaoPosicao');

async function listar(req, res) {
  const [rows] = await pool.execute('SELECT * FROM localizacao ORDER BY corredor, nivel, posicao');
  return res.json(rows);
}

async function lotesPorLocalizacao(req, res) {
  const [rows] = await pool.execute(
    `SELECT l.*, p.nome AS produto_nome
     FROM lote l JOIN produto p ON p.id = l.id_produto
     WHERE l.id_localizacao = ? ORDER BY l.numero_lote`,
    [req.params.id]
  );
  return res.json(rows);
}

async function criar(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { corredor, nivel, posicao, descricao } = req.body;
  const [result] = await pool.execute(
    'INSERT INTO localizacao (corredor, nivel, posicao, descricao) VALUES (?,?,?,?)',
    [corredor, nivel, posicao, descricao || null]
  );

  await logAudit({ tabela: 'localizacao', operacao: 'INSERT', valorNovo: `${corredor}-${nivel}-${posicao}`, idUsuario: req.user.id, ip: req.ip });
  return res.status(201).json({ id: result.insertId, corredor, nivel, posicao });
}

async function sugestao(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { id_produto, quantidade, data_validade } = req.query;
  try {
    const resultado = await sugerirPosicoes(id_produto, { quantidade, data_validade });
    if (!resultado) return res.status(404).json({ error: 'Produto não encontrado' });
    return res.json(resultado);
  } catch (error) {
    return next(error);
  }
}

module.exports = { listar, lotesPorLocalizacao, criar, sugestao };
