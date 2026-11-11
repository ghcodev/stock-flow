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

  const { corredor, nivel, posicao, descricao, capacidade = null, tipo_zona = 'seco', distancia_expedicao = 0 } = req.body;
  const [result] = await pool.execute(
    'INSERT INTO localizacao (corredor, nivel, posicao, descricao, capacidade, tipo_zona, distancia_expedicao) VALUES (?,?,?,?,?,?,?)',
    [corredor, nivel, posicao, descricao || null, capacidade, tipo_zona, distancia_expedicao]
  );

  await logAudit({ tabela: 'localizacao', operacao: 'INSERT', valorNovo: `${corredor}-${nivel}-${posicao}`, idUsuario: req.user.id, ip: req.ip });
  return res.status(201).json({ id: result.insertId, corredor, nivel, posicao, capacidade, tipo_zona, distancia_expedicao });
}

async function atualizar(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const [[anterior]] = await pool.execute('SELECT * FROM localizacao WHERE id = ?', [req.params.id]);
  if (!anterior) return res.status(404).json({ error: 'Localização não encontrada' });

  const { corredor, nivel, posicao, descricao, capacidade, tipo_zona, distancia_expedicao } = req.body;
  const novo = {
    corredor: corredor ?? anterior.corredor,
    nivel: nivel ?? anterior.nivel,
    posicao: posicao ?? anterior.posicao,
    descricao: descricao === undefined ? anterior.descricao : descricao || null,
    capacidade: capacidade === undefined ? anterior.capacidade : capacidade,
    tipo_zona: tipo_zona ?? anterior.tipo_zona,
    distancia_expedicao: distancia_expedicao ?? anterior.distancia_expedicao,
  };
  await pool.execute(
    'UPDATE localizacao SET corredor=?, nivel=?, posicao=?, descricao=?, capacidade=?, tipo_zona=?, distancia_expedicao=? WHERE id=?',
    [novo.corredor, novo.nivel, novo.posicao, novo.descricao, novo.capacidade, novo.tipo_zona, novo.distancia_expedicao, anterior.id]
  );

  await logAudit({
    tabela: 'localizacao', operacao: 'UPDATE',
    valorAnterior: { corredor: anterior.corredor, nivel: anterior.nivel, posicao: anterior.posicao, capacidade: anterior.capacidade, tipo_zona: anterior.tipo_zona, distancia_expedicao: anterior.distancia_expedicao },
    valorNovo: { corredor: novo.corredor, nivel: novo.nivel, posicao: novo.posicao, capacidade: novo.capacidade, tipo_zona: novo.tipo_zona, distancia_expedicao: novo.distancia_expedicao },
    idUsuario: req.user.id, ip: req.ip,
  });
  return res.json({ id: anterior.id, ...novo });
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

module.exports = { listar, lotesPorLocalizacao, criar, atualizar, sugestao };
