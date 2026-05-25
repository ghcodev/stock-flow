const { validationResult } = require('express-validator');
const pool = require('../config/database');
const logAudit = require('../middleware/audit');

function err(res, status, msg, codigo = null) {
  return res.status(status).json({ error: msg, ...(codigo && { codigo }), timestamp: new Date().toISOString() });
}

async function listar(req, res) {
  const { tipo = '', lote = '', usuario = '', page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  const conds = [];
  if (tipo) { conds.push('m.tipo = ?'); params.push(tipo); }
  if (lote) { conds.push('m.id_lote = ?'); params.push(lote); }
  if (usuario) { conds.push('m.id_usuario = ?'); params.push(usuario); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const [rows] = await pool.execute(
    `SELECT m.*, u.nome AS usuario_nome, l.numero_lote
     FROM movimentacao m
     JOIN usuario u ON u.id = m.id_usuario
     JOIN lote l ON l.id = m.id_lote
     ${where} ORDER BY m.data_movimentacao DESC LIMIT ${Number(limit)} OFFSET ${offset}`,
    params
  );
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM movimentacao m ${where}`, params);
  return res.json({ data: rows, total, page: Number(page), limit: Number(limit) });
}

async function entrada(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { id_lote, quantidade, id_localizacao_destino, observacao } = req.body;

  const [lotes] = await pool.execute('SELECT * FROM lote WHERE id = ?', [id_lote]);
  if (!lotes.length) return err(res, 404, 'Lote não encontrado');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO movimentacao (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, observacao, status)
       VALUES ('entrada',?,?,?,?,?,'concluida')`,
      [quantidade, id_lote, req.user.id, id_localizacao_destino || null, observacao || null]
    );
    await conn.execute('UPDATE lote SET quantidade = quantidade + ? WHERE id = ?', [quantidade, id_lote]);
    await conn.commit();

    await logAudit({ tabela: 'movimentacao', operacao: 'INSERT', valorNovo: `tipo:entrada,qtd:${quantidade},lote:${id_lote}`, idUsuario: req.user.id, ip: req.ip });
    return res.status(201).json({ id: result.insertId, mensagem: 'Entrada registrada' });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function saida(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { id_lote, quantidade, observacao } = req.body;

  const [lotes] = await pool.execute('SELECT * FROM lote WHERE id = ?', [id_lote]);
  if (!lotes.length) return err(res, 404, 'Lote não encontrado');
  const lote = lotes[0];

  if (lote.status_lote === 'bloqueado') return err(res, 422, 'Lote bloqueado — saída não permitida', 'RN16');
  if (Number(quantidade) > Number(lote.quantidade)) return err(res, 422, `Quantidade insuficiente. Disponível: ${lote.quantidade}`, 'RN11');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO movimentacao (tipo, quantidade, id_lote, id_usuario, observacao, status)
       VALUES ('saida',?,?,?,?,'concluida')`,
      [quantidade, id_lote, req.user.id, observacao || null]
    );
    await conn.execute('UPDATE lote SET quantidade = quantidade - ? WHERE id = ?', [quantidade, id_lote]);
    await conn.commit();

    await logAudit({ tabela: 'movimentacao', operacao: 'INSERT', valorNovo: `tipo:saida,qtd:${quantidade},lote:${id_lote}`, idUsuario: req.user.id, ip: req.ip });
    return res.status(201).json({ id: result.insertId, mensagem: 'Saída registrada' });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function transferencia(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { id_lote, id_localizacao_destino, motivo_movimentacao } = req.body;

  const [lotes] = await pool.execute('SELECT * FROM lote WHERE id = ?', [id_lote]);
  if (!lotes.length) return err(res, 404, 'Lote não encontrado');
  const lote = lotes[0];

  if (lote.status_lote === 'bloqueado') return err(res, 422, 'Lote bloqueado — transferência não permitida', 'RN16');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO movimentacao (tipo, quantidade, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, status)
       VALUES ('transferencia', ?, ?, ?, ?, ?, ?, 'concluida')`,
      [lote.quantidade, id_lote, req.user.id, lote.id_localizacao, id_localizacao_destino, motivo_movimentacao]
    );
    await conn.execute('UPDATE lote SET id_localizacao = ? WHERE id = ?', [id_localizacao_destino, id_lote]);
    await conn.commit();

    await logAudit({
      tabela: 'movimentacao', operacao: 'INSERT',
      valorNovo: `tipo:transferencia,lote:${id_lote},de:${lote.id_localizacao},para:${id_localizacao_destino}`,
      idUsuario: req.user.id, ip: req.ip,
    });
    return res.status(201).json({ id: result.insertId, mensagem: 'Transferência realizada' });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function ajuste(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { id_lote, nova_quantidade, justificativa } = req.body;

  const [lotes] = await pool.execute('SELECT * FROM lote WHERE id = ?', [id_lote]);
  if (!lotes.length) return err(res, 404, 'Lote não encontrado');
  const lote = lotes[0];

  const diff = Number(nova_quantidade) - Number(lote.quantidade);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO movimentacao (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, status)
       VALUES ('ajuste', ?, ?, ?, ?, 'concluida')`,
      [Math.abs(diff) || 1, id_lote, req.user.id, justificativa]
    );
    await conn.execute('UPDATE lote SET quantidade = ? WHERE id = ?', [nova_quantidade, id_lote]);
    await conn.commit();

    await logAudit({
      tabela: 'lote', operacao: 'AJUSTE',
      valorAnterior: `quantidade:${lote.quantidade}`,
      valorNovo: `quantidade:${nova_quantidade},justificativa:${justificativa}`,
      idUsuario: req.user.id, ip: req.ip,
    });
    return res.status(201).json({ id: result.insertId, mensagem: 'Ajuste realizado', quantidade_anterior: lote.quantidade, nova_quantidade });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function inventario(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { contagens } = req.body;
  const ids = contagens.map(c => c.id_lote);

  if (!ids.length) return res.json({ divergencias: [] });

  const [lotes] = await pool.execute(
    `SELECT id, numero_lote, quantidade FROM lote WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  const mapa = Object.fromEntries(lotes.map(l => [l.id, l]));

  const divergencias = contagens
    .map(c => {
      const lote = mapa[c.id_lote];
      if (!lote) return { id_lote: c.id_lote, erro: 'Lote não encontrado' };
      const diff = Number(c.quantidade_contada) - Number(lote.quantidade);
      return { id_lote: c.id_lote, numero_lote: lote.numero_lote, quantidade_sistema: lote.quantidade, quantidade_contada: c.quantidade_contada, divergencia: diff };
    })
    .filter(d => d.divergencia !== 0 || d.erro);

  return res.json({ divergencias, total_contado: contagens.length, total_divergencias: divergencias.length });
}

module.exports = { listar, entrada, saida, transferencia, ajuste, inventario };
