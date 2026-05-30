const pool = require('../config/database');

function normalizarIP(req) {
  const raw = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.ip
            || req.socket?.remoteAddress
            || 'desconhecido';
  return raw.replace(/^::ffff:/, '');
}

function normalizeAuditValue(value) {
  if (value === null || value === undefined) return '{}';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return JSON.stringify({ descricao: 'Evento de auditoria' });
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // Detecta formato legado "chave:valor" e converte para JSON
      if (!trimmed.startsWith('{') && trimmed.includes(':')) {
        const [chave, ...resto] = trimmed.split(':');
        return JSON.stringify({ [chave.trim()]: resto.join(':').trim() });
      }
      return JSON.stringify({ descricao: trimmed });
    }
  }
  return JSON.stringify({ descricao: 'Evento de auditoria' });
}

async function logAudit({ tabela, operacao, valorAnterior = null, valorNovo = null, idUsuario = null, ip = null }) {
  const rawIp = typeof ip === 'string' && ip.trim() ? ip.trim() : 'interno';
  const safeIp = rawIp.replace(/^::ffff:/, '');
  const safeValorAnterior = valorAnterior == null ? null : normalizeAuditValue(valorAnterior);
  const safeValorNovo = normalizeAuditValue(valorNovo);
  await pool.execute(
    `INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario)
     VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
    [tabela, operacao, safeValorAnterior, safeValorNovo, idUsuario || null, safeIp]
  );
}

module.exports = logAudit;
module.exports.normalizarIP = normalizarIP;
module.exports.normalizeAuditValue = normalizeAuditValue;
