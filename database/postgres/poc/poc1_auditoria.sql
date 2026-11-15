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

SELECT pg_temp.afirmar(
  (SELECT count(*) = 1 FROM auditoria_log a
   WHERE a.tabela_afetada = 'lote' AND a.operacao = 'UPDATE'
     AND (a.valor_anterior->>'quantidade')::numeric = 100
     AND (a.valor_novo->>'quantidade')::numeric = 70
     AND a.id_usuario = (SELECT id_usuario FROM usuario WHERE email = 'admin@stockflow.local')
     AND a.ip_usuario = '192.168.0.10'),
  'atualização do lote auditada com valores, usuário e IP');
SELECT pg_temp.afirmar(
  (SELECT count(*) = 1 FROM auditoria_log a
   WHERE a.tabela_afetada = 'movimentacao' AND a.operacao = 'INSERT'
     AND (a.valor_novo->>'quantidade')::numeric = 30
     AND a.id_usuario = (SELECT id_usuario FROM usuario WHERE email = 'admin@stockflow.local')
     AND a.ip_usuario = '192.168.0.10'),
  'inserção da movimentação auditada com usuário e IP');
SELECT pg_temp.afirmar(coalesce(current_setting('app.user_id', true), '') = '', 'app.user_id vazio após o COMMIT');
SELECT pg_temp.afirmar(
  (SELECT count(*) > 0 FROM auditoria_log WHERE tabela_afetada = 'usuario')
  AND NOT (SELECT coalesce(bool_or(valor_novo ? 'senha_hash'), false) FROM auditoria_log WHERE tabela_afetada = 'usuario'),
  'auditoria de usuário existe e não contém senha_hash');

BEGIN;
SELECT set_config('app.user_id', (SELECT id_usuario::text FROM usuario WHERE email = 'admin@stockflow.local'), true),
       set_config('app.ip', '192.168.0.11', true);
UPDATE movimentacao SET status_movimentacao = 'cancelada'
WHERE id_movimentacao = (SELECT min(id_movimentacao) FROM movimentacao WHERE tipo_movimentacao = 'saida');
COMMIT;

SELECT pg_temp.afirmar(
  (SELECT count(*) = 1 FROM auditoria_log a
   WHERE a.tabela_afetada = 'movimentacao' AND a.operacao = 'UPDATE'
     AND a.valor_anterior->>'status_movimentacao' = 'concluida'
     AND a.valor_novo->>'status_movimentacao' = 'cancelada'
     AND a.id_usuario = (SELECT id_usuario FROM usuario WHERE email = 'admin@stockflow.local')
     AND a.ip_usuario = '192.168.0.11'),
  'mudança de status_movimentacao auditada com valor anterior, novo, usuário e IP');

BEGIN;
SELECT set_config('app.user_id', (SELECT id_usuario::text FROM usuario WHERE email = 'admin@stockflow.local'), true),
       set_config('app.ip', '192.168.0.12', true);
UPDATE usuario SET nome = 'Administrador PoC Atualizado', senha_hash = repeat('y', 60) WHERE email = 'admin@stockflow.local';
COMMIT;

SELECT pg_temp.afirmar(
  (SELECT count(*) = 1 FROM auditoria_log a
   WHERE a.tabela_afetada = 'usuario' AND a.operacao = 'UPDATE'
     AND a.valor_anterior->>'nome' = 'Administrador PoC'
     AND a.valor_novo->>'nome' = 'Administrador PoC Atualizado'
     AND NOT (a.valor_anterior ? 'senha_hash')
     AND NOT (a.valor_novo ? 'senha_hash')
     AND a.id_usuario = (SELECT id_usuario FROM usuario WHERE email = 'admin@stockflow.local')
     AND a.ip_usuario = '192.168.0.12'),
  'atualização de usuário auditada sem senha_hash em valor_anterior e valor_novo');
