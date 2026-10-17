\set ON_ERROR_STOP 1
BEGIN;
SELECT set_config('app.user_id', (SELECT id_usuario::text FROM usuario WHERE email = 'admin@stockflow.local'), true),
       set_config('app.ip', '192.168.0.10', true);
SELECT quantidade FROM lote WHERE numero_lote = 'L-001' FOR UPDATE;
UPDATE lote SET quantidade = quantidade - 30 WHERE numero_lote = 'L-001';
INSERT INTO movimentacao (tipo_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario)
SELECT 'saida', 30, 100, 70, l.id_lote, u.id_usuario
FROM lote l, usuario u
WHERE l.numero_lote = 'L-001' AND u.email = 'admin@stockflow.local';
COMMIT;

SELECT id_log, tabela_afetada, operacao,
       valor_anterior->>'quantidade' AS antes,
       valor_novo->>'quantidade' AS depois,
       id_usuario, ip_usuario
FROM auditoria_log
WHERE tabela_afetada IN ('lote', 'movimentacao') AND id_usuario IS NOT NULL
ORDER BY id_log;

SELECT current_setting('app.user_id', true) AS variavel_apos_commit;
SELECT bool_or(valor_novo ? 'senha_hash') AS senha_hash_no_log FROM auditoria_log WHERE tabela_afetada = 'usuario';
