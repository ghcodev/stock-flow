const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const pool = require('../config/database');
const logAudit = require('../middleware/audit');

async function listar(req, res) {
  const [rows] = await pool.execute('SELECT id, nome, email, perfil, ativo, permissoes, criado_em FROM usuario ORDER BY nome');
  return res.json(rows);
}

async function buscarPorId(req, res) {
  const [rows] = await pool.execute(
    'SELECT id, nome, email, perfil, ativo, permissoes, criado_em FROM usuario WHERE id = ?',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
  return res.json(rows[0]);
}

async function perfil(req, res) {
  const [rows] = await pool.execute(
    'SELECT id, nome, email, perfil, ativo, permissoes, criado_em FROM usuario WHERE id = ?',
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
  return res.json(rows[0]);
}

async function criar(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { nome, email, senha, perfil: p = 'operador' } = req.body;

  const [dup] = await pool.execute('SELECT id FROM usuario WHERE email = ?', [email]);
  if (dup.length) return res.status(409).json({ error: 'E-mail já cadastrado' });

  const hash = await bcrypt.hash(senha, 12);
  const [result] = await pool.execute(
    'INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES (?,?,?,?)',
    [nome, email, hash, p]
  );

  await logAudit({ tabela: 'usuario', operacao: 'INSERT', valorNovo: `email:${email},perfil:${p}`, idUsuario: req.user.id, ip: req.ip });
  return res.status(201).json({ id: result.insertId, nome, email, perfil: p });
}

async function atualizar(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const [rows] = await pool.execute('SELECT * FROM usuario WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });

  const ant = rows[0];
  const { nome, email, perfil: p, permissoes } = req.body;
  const permissoesValue = permissoes === undefined ? ant.permissoes : JSON.stringify(permissoes || null);

  await pool.execute(
    'UPDATE usuario SET nome=?, email=?, perfil=?, permissoes=? WHERE id=?',
    [nome ?? ant.nome, email ?? ant.email, p ?? ant.perfil, permissoesValue, req.params.id]
  );

  await logAudit({ tabela: 'usuario', operacao: 'UPDATE', valorAnterior: `email:${ant.email}`, valorNovo: `email:${email ?? ant.email}`, idUsuario: req.user.id, ip: req.ip });
  return res.json({ mensagem: 'Usuário atualizado' });
}

async function inativar(req, res) {
  const [rows] = await pool.execute('SELECT id, email FROM usuario WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });

  await pool.execute('UPDATE usuario SET ativo = 0 WHERE id = ?', [req.params.id]);
  await logAudit({ tabela: 'usuario', operacao: 'UPDATE', valorNovo: `inativado:${rows[0].email}`, idUsuario: req.user.id, ip: req.ip });
  return res.json({ mensagem: 'Usuário inativado' });
}

module.exports = { listar, buscarPorId, perfil, criar, atualizar, inativar };
