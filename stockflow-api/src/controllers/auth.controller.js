const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const pool = require('../config/database');
const { addToBlacklist } = require('../middleware/auth');
const logAudit = require('../middleware/audit');

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { email, senha } = req.body;

  const [rows] = await pool.execute('SELECT * FROM usuario WHERE email = ? AND ativo = 1', [email]);
  if (!rows.length) {
    return res.status(401).json({ error: 'Credenciais inválidas', timestamp: new Date().toISOString() });
  }

  const usuario = rows[0];
  const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaOk) {
    return res.status(401).json({ error: 'Credenciais inválidas', timestamp: new Date().toISOString() });
  }

  const payload = { id: usuario.id, email: usuario.email, perfil: usuario.perfil, nome: usuario.nome, permissoes: usuario.permissoes || null };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

  await logAudit({
    tabela: 'usuario',
    operacao: 'LOGIN',
    valorNovo: `email:${usuario.email}`,
    idUsuario: usuario.id,
    ip: req.ip,
  });

  return res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, permissoes: usuario.permissoes || null },
  });
}

async function logout(req, res) {
  addToBlacklist(req.token);
  return res.json({ mensagem: 'Logout realizado com sucesso' });
}

async function alterarSenha(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { senha_atual, nova_senha } = req.body;
  const [rows] = await pool.execute('SELECT senha_hash FROM usuario WHERE id = ?', [req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });

  const ok = await bcrypt.compare(senha_atual, rows[0].senha_hash);
  if (!ok) return res.status(401).json({ error: 'Senha atual incorreta', timestamp: new Date().toISOString() });

  const hash = await bcrypt.hash(nova_senha, 12);
  await pool.execute('UPDATE usuario SET senha_hash = ? WHERE id = ?', [hash, req.user.id]);

  await logAudit({ tabela: 'usuario', operacao: 'UPDATE', valorNovo: 'senha alterada', idUsuario: req.user.id, ip: req.ip });

  return res.json({ mensagem: 'Senha alterada com sucesso' });
}

module.exports = { login, logout, alterarSenha };
