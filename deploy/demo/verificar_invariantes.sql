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

SELECT min(data_movimentacao)::date AS primeira_movimentacao, max(data_movimentacao)::date AS ultima_movimentacao, current_date AS hoje, current_setting('TimeZone') AS fuso FROM movimentacao;

CREATE TEMP TABLE alteradoras AS
SELECT id_movimentacao, id_lote, saldo_anterior, saldo_posterior,
       row_number() OVER (PARTITION BY id_lote ORDER BY data_movimentacao, id_movimentacao) AS n,
       lag(saldo_posterior) OVER (PARTITION BY id_lote ORDER BY data_movimentacao, id_movimentacao) AS posterior_anterior,
       row_number() OVER (PARTITION BY id_lote ORDER BY data_movimentacao DESC, id_movimentacao DESC) AS desc_n
FROM movimentacao
WHERE status_movimentacao = 'concluida' AND tipo_movimentacao IN ('entrada', 'saida', 'ajuste');

SELECT 'lotes cujo saldo difere do ultimo saldo_posterior' AS verificacao, count(*) AS violacoes
FROM lote l
LEFT JOIN alteradoras a ON a.id_lote = l.id_lote AND a.desc_n = 1
WHERE l.quantidade <> COALESCE(a.saldo_posterior, 0)
UNION ALL
SELECT 'buracos na cadeia de saldos (anterior diferente do posterior anterior)', count(*)
FROM alteradoras WHERE saldo_anterior <> COALESCE(posterior_anterior, 0)
UNION ALL
SELECT 'movimentacoes que alteram saldo com delta incoerente', count(*)
FROM movimentacao m
WHERE m.status_movimentacao = 'concluida' AND m.tipo_movimentacao IN ('entrada', 'saida', 'ajuste')
  AND abs(m.saldo_posterior - m.saldo_anterior) <> m.quantidade
UNION ALL
SELECT 'saidas em lote vencido ou bloqueado na data da saida', count(*)
FROM movimentacao m JOIN lote l ON l.id_lote = m.id_lote
WHERE m.tipo_movimentacao = 'saida'
  AND ((l.status_lote = 'bloqueado' AND m.data_movimentacao >= l.data_bloqueio) OR m.data_movimentacao::date > l.data_validade)
UNION ALL
SELECT 'movimentacoes no futuro', count(*) FROM movimentacao WHERE data_movimentacao > now()
UNION ALL
SELECT 'registros de auditoria no futuro', count(*) FROM auditoria_log WHERE data_hora > now()
UNION ALL
SELECT 'ids de auditoria fora da ordem cronologica', count(*)
FROM (SELECT data_hora, lag(data_hora) OVER (ORDER BY id_log) AS ant FROM auditoria_log) x WHERE ant IS NOT NULL AND data_hora < ant
UNION ALL
SELECT 'lotes sem etiqueta', count(*) FROM lote l WHERE NOT EXISTS (SELECT 1 FROM identificacao i WHERE i.id_lote = l.id_lote)
UNION ALL
SELECT 'usuarios com hash que nao e bcrypt custo 12', count(*) FROM usuario WHERE senha_hash !~ '^[$]2b[$]12[$]'
ORDER BY 1;

SELECT CASE WHEN (
  (SELECT count(*) FROM lote l LEFT JOIN alteradoras a ON a.id_lote = l.id_lote AND a.desc_n = 1 WHERE l.quantidade <> COALESCE(a.saldo_posterior, 0))
  + (SELECT count(*) FROM alteradoras WHERE saldo_anterior <> COALESCE(posterior_anterior, 0))
) = 0 THEN 'INVARIANTE DE SALDO: OK' ELSE 'INVARIANTE DE SALDO: VIOLADO' END AS resultado;
