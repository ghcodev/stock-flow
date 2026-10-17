\set ON_ERROR_STOP 0
\echo 'Esperado: permission denied'
UPDATE auditoria_log SET operacao = 'DELETE' WHERE id_log = 1;
\echo 'Esperado: permission denied'
DELETE FROM auditoria_log;
UPDATE lote SET status_lote = 'bloqueado' WHERE numero_lote = 'L-001';
\echo 'Esperado: saída não permitida para lote vencido ou bloqueado'
INSERT INTO movimentacao (tipo_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario)
SELECT 'saida', 5, 70, 65, l.id_lote, u.id_usuario FROM lote l, usuario u
WHERE l.numero_lote = 'L-001' AND u.email = 'admin@stockflow.local';
UPDATE lote SET status_lote = 'ativo' WHERE numero_lote = 'L-001';
\echo 'Esperado: violação de CHECK (origem igual ao destino)'
INSERT INTO movimentacao (tipo_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino)
SELECT 'transferencia', 70, 70, 70, l.id_lote, u.id_usuario, l.id_localizacao, l.id_localizacao FROM lote l, usuario u
WHERE l.numero_lote = 'L-001' AND u.email = 'admin@stockflow.local';
\echo 'Esperado: violação de CHECK (saída com quantidade zero)'
INSERT INTO movimentacao (tipo_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario)
SELECT 'saida', 0, 70, 70, l.id_lote, u.id_usuario FROM lote l, usuario u
WHERE l.numero_lote = 'L-001' AND u.email = 'admin@stockflow.local';
\echo 'Esperado: INSERT 0 1 (inventário com contagem zero é aceito)'
INSERT INTO movimentacao (tipo_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario)
SELECT 'inventario', 0, 70, 70, l.id_lote, u.id_usuario FROM lote l, usuario u
WHERE l.numero_lote = 'L-001' AND u.email = 'admin@stockflow.local';
