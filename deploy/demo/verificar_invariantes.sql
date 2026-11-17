\set ON_ERROR_STOP on
\pset footer off

SELECT 'produtos' AS item, count(*) AS total FROM produto
UNION ALL SELECT 'usuarios (admin + operador)', count(*) FROM usuario
UNION ALL SELECT 'localizacoes', count(*) FROM localizacao
UNION ALL SELECT 'lotes', count(*) FROM lote
UNION ALL SELECT 'lotes ativos', count(*) FROM lote WHERE status_lote = 'ativo'
UNION ALL SELECT 'lotes vencidos', count(*) FROM lote WHERE status_lote = 'vencido'
UNION ALL SELECT 'lotes bloqueados', count(*) FROM lote WHERE status_lote = 'bloqueado'
UNION ALL SELECT 'lotes ativos vencendo em 30 dias', count(*) FROM lote WHERE status_lote = 'ativo' AND data_validade BETWEEN current_date AND current_date + 30
UNION ALL SELECT 'etiquetas', count(*) FROM identificacao
UNION ALL SELECT 'movimentacoes', count(*) FROM movimentacao
UNION ALL SELECT 'contagens pendentes', count(*) FROM movimentacao WHERE tipo_movimentacao = 'inventario' AND status_movimentacao = 'pendente'
UNION ALL SELECT 'contagens concluidas', count(*) FROM movimentacao WHERE tipo_movimentacao = 'inventario' AND status_movimentacao = 'concluida'
UNION ALL SELECT 'contagens canceladas', count(*) FROM movimentacao WHERE tipo_movimentacao = 'inventario' AND status_movimentacao = 'cancelada'
UNION ALL SELECT 'ajustes', count(*) FROM movimentacao WHERE tipo_movimentacao = 'ajuste'
UNION ALL SELECT 'produtos abaixo do minimo', count(*) FROM (SELECT p.id_produto FROM produto p LEFT JOIN lote l ON l.id_produto = p.id_produto AND l.status_lote = 'ativo' GROUP BY p.id_produto, p.estoque_minimo HAVING COALESCE(sum(l.quantidade), 0) < p.estoque_minimo) x
UNION ALL SELECT 'registros de auditoria', count(*) FROM auditoria_log
UNION ALL SELECT 'dias com movimentacao', count(DISTINCT data_movimentacao::date) FROM movimentacao
ORDER BY 1;

SELECT min(data_hora) AS auditoria_primeiro_registro, max(data_hora) AS auditoria_ultimo_registro FROM auditoria_log;

SELECT min(data_movimentacao)::date AS primeira_movimentacao, max(data_movimentacao)::date AS ultima_movimentacao, current_date AS hoje, current_setting('TimeZone') AS fuso FROM movimentacao;

\i /demo/assercao_invariantes.sql
