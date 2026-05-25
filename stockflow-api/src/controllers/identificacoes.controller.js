const { validationResult } = require('express-validator');
const pool = require('../config/database');
const logAudit = require('../middleware/audit');

async function buscarPorCodigo(req, res) {
  const [rows] = await pool.execute(
    `SELECT i.*, l.numero_lote, l.quantidade, l.status_lote,
            p.nome AS produto_nome, loc.corredor, loc.nivel, loc.posicao
     FROM identificacao i
     JOIN lote l ON l.id = i.id_lote
     JOIN produto p ON p.id = l.id_produto
     JOIN localizacao loc ON loc.id = l.id_localizacao
     WHERE i.codigo = ?`,
    [req.params.codigo]
  );
  if (!rows.length) return res.status(404).json({ error: 'Código não encontrado' });
  return res.json(rows[0]);
}

async function criar(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { tipo, codigo, id_lote } = req.body;

  const [lotex] = await pool.execute('SELECT id FROM lote WHERE id = ?', [id_lote]);
  if (!lotex.length) return res.status(404).json({ error: 'Lote não encontrado' });

  const [dup] = await pool.execute('SELECT id FROM identificacao WHERE id_lote = ?', [id_lote]);
  if (dup.length) return res.status(409).json({ error: 'Este lote já possui identificação cadastrada' });

  const [dupCod] = await pool.execute('SELECT id FROM identificacao WHERE codigo = ?', [codigo]);
  if (dupCod.length) return res.status(409).json({ error: 'Código já utilizado por outro lote' });

  const [result] = await pool.execute(
    'INSERT INTO identificacao (tipo, codigo, id_lote) VALUES (?,?,?)',
    [tipo, codigo, id_lote]
  );

  await logAudit({ tabela: 'identificacao', operacao: 'INSERT', valorNovo: `tipo:${tipo},codigo:${codigo},lote:${id_lote}`, idUsuario: req.user.id, ip: req.ip });
  return res.status(201).json({ id: result.insertId, tipo, codigo, id_lote });
}

module.exports = { buscarPorCodigo, criar };
