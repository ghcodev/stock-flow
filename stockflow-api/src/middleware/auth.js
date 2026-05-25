const jwt = require('jsonwebtoken');

const blacklist = new Set();

function addToBlacklist(token) {
  blacklist.add(token);
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido', timestamp: new Date().toISOString() });
  }

  const token = header.split(' ')[1];

  if (blacklist.has(token)) {
    return res.status(401).json({ error: 'Token inválido (logout efetuado)', timestamp: new Date().toISOString() });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    req.token = token;
    next();
  } catch {
    return res.status(401).json({ error: 'Token expirado ou inválido', timestamp: new Date().toISOString() });
  }
}

module.exports = { authMiddleware, addToBlacklist };
