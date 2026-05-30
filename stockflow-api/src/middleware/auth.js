const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) throw new Error('JWT_SECRET não definido no .env');

const blacklist = new Set();

function addToBlacklist(token) {
  blacklist.add(token);
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido', timestamp: new Date().toISOString() });
  }

  const token = header.split(' ')[1];

  if (blacklist.has(token)) {
    return res.status(401).json({ error: 'Token inválido (logout efetuado)', timestamp: new Date().toISOString() });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.execute(
      'SELECT id, nome, email, perfil, permissoes FROM usuario WHERE id = ? AND ativo = 1',
      [payload.id]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Usuário inativo ou não encontrado', timestamp: new Date().toISOString() });
    }
    req.user = {
      ...payload,
      id: rows[0].id,
      nome: rows[0].nome,
      email: rows[0].email,
      perfil: rows[0].perfil,
      permissoes: rows[0].permissoes,
    };
    req.token = token;
    next();
  } catch {
    return res.status(401).json({ error: 'Token expirado ou inválido', timestamp: new Date().toISOString() });
  }
}

module.exports = { authMiddleware, addToBlacklist };
