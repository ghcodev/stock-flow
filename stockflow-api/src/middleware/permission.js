const DEFAULT_OPERATOR_PERMISSIONS = {
  produtos: { ver: true, criar: true, editar: true, inativar: false },
  lotes: { ver: true, criar: true, bloquear: false },
  movimentacoes: { entrada: true, saida: true, transferencia: true, ajuste: false },
  auditoria: { ver: false },
  usuarios: { ver: false, criar: false },
  relatorios: { ver: true, exportar: false },
  sap: { importar: false },
};

function parsePermissions(permissoes) {
  if (!permissoes) return null;
  if (typeof permissoes === 'object') return permissoes;
  try {
    return JSON.parse(permissoes);
  } catch {
    return null;
  }
}

const checkPermission = (modulo, acao) => {
  return (req, res, next) => {
    const { perfil } = req.user || {};
    const permissoes = parsePermissions(req.user?.permissoes);

    if (perfil === 'administrador') return next();
    if (permissoes?.[modulo]?.[acao] === true) return next();
    if (DEFAULT_OPERATOR_PERMISSIONS[modulo]?.[acao]) return next();

    return res.status(403).json({
      error: 'Permissão negada.',
      modulo,
      acao,
    });
  };
};

module.exports = { checkPermission, DEFAULT_OPERATOR_PERMISSIONS, parsePermissions };
