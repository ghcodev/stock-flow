function adminMiddleware(req, res, next) {
  if (req.user?.perfil !== 'administrador') {
    return res.status(403).json({
      error: 'Acesso restrito a administradores',
      timestamp: new Date().toISOString(),
    });
  }
  next();
}

module.exports = adminMiddleware;
