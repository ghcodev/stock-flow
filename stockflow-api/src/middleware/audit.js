const pool = require('../config/database');

async function logAudit({ tabela, operacao, valorAnterior = null, valorNovo = null, idUsuario = null, ip = null }) {
  await pool.execute(
    `INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario)
     VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
    [tabela, operacao, valorAnterior, valorNovo, idUsuario, ip]
  );
}

module.exports = logAudit;
