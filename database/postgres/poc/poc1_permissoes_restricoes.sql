\set ON_ERROR_STOP 1
SELECT pg_temp.esperar_erro($q$UPDATE auditoria_log SET operacao = 'DELETE' WHERE id_log = 1$q$, '42501');
SELECT pg_temp.esperar_erro($q$DELETE FROM auditoria_log$q$, '42501');
SELECT pg_temp.esperar_erro($q$UPDATE movimentacao SET quantidade = 1 WHERE id_movimentacao = 1$q$, '42501');
SELECT pg_temp.esperar_erro($q$DELETE FROM movimentacao WHERE id_movimentacao = 1$q$, '42501');

BEGIN;
UPDATE lote SET status_lote = 'bloqueado' WHERE numero_lote = 'L-001';
SELECT pg_temp.esperar_erro($q$INSERT INTO movimentacao (tipo_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario)
SELECT 'saida', 5, 70, 65, l.id_lote, u.id_usuario FROM lote l, usuario u
WHERE l.numero_lote = 'L-001' AND u.email = 'admin@stockflow.local'$q$, 'P0001', 'permitida');
ROLLBACK;

BEGIN;
UPDATE lote SET data_fabricacao = current_date - 30, data_validade = current_date - 1 WHERE numero_lote = 'L-001';
SELECT pg_temp.afirmar((SELECT status_lote = 'ativo' FROM lote WHERE numero_lote = 'L-001'), 'lote de teste continua com status ativo');
SELECT pg_temp.esperar_erro($q$INSERT INTO movimentacao (tipo_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario)
SELECT 'saida', 5, 70, 65, l.id_lote, u.id_usuario FROM lote l, usuario u
WHERE l.numero_lote = 'L-001' AND u.email = 'admin@stockflow.local'$q$, 'P0001', 'validade expirada');
ROLLBACK;

SELECT pg_temp.esperar_erro($q$INSERT INTO movimentacao (tipo_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino)
SELECT 'transferencia', 70, 70, 70, l.id_lote, u.id_usuario, l.id_localizacao, l.id_localizacao FROM lote l, usuario u
WHERE l.numero_lote = 'L-001' AND u.email = 'admin@stockflow.local'$q$, '23514');
SELECT pg_temp.esperar_erro($q$INSERT INTO movimentacao (tipo_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario)
SELECT 'saida', 0, 70, 70, l.id_lote, u.id_usuario FROM lote l, usuario u
WHERE l.numero_lote = 'L-001' AND u.email = 'admin@stockflow.local'$q$, '23514');

BEGIN;
INSERT INTO movimentacao (tipo_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario)
SELECT 'inventario', 0, 70, 70, l.id_lote, u.id_usuario FROM lote l, usuario u
WHERE l.numero_lote = 'L-001' AND u.email = 'admin@stockflow.local';
SELECT pg_temp.afirmar((SELECT count(*) = 1 FROM movimentacao WHERE tipo_movimentacao = 'inventario' AND quantidade = 0), 'inventário com contagem zero aceito');
ROLLBACK;
