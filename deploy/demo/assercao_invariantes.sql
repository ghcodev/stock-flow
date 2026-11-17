\if :{?checar_etiqueta}
\else
\set checar_etiqueta 0
\endif

DROP TABLE IF EXISTS pg_temp.alteradoras;
DROP TABLE IF EXISTS pg_temp.violacoes;

CREATE TEMP TABLE alteradoras AS
SELECT id_movimentacao, id_lote, saldo_anterior, saldo_posterior,
       lag(saldo_posterior) OVER (PARTITION BY id_lote ORDER BY data_movimentacao, id_movimentacao) AS posterior_anterior,
       row_number() OVER (PARTITION BY id_lote ORDER BY data_movimentacao DESC, id_movimentacao DESC) AS desc_n
FROM movimentacao
WHERE status_movimentacao = 'concluida' AND tipo_movimentacao IN ('entrada', 'saida', 'ajuste');

CREATE TEMP TABLE violacoes AS
SELECT 'lotes cujo saldo difere do ultimo saldo_posterior' AS verificacao, count(*) AS total
FROM lote l LEFT JOIN alteradoras a ON a.id_lote = l.id_lote AND a.desc_n = 1
WHERE l.quantidade <> COALESCE(a.saldo_posterior, 0)
UNION ALL
SELECT 'buracos na cadeia de saldos', count(*) FROM alteradoras WHERE saldo_anterior <> COALESCE(posterior_anterior, 0)
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
SELECT 'movimentacoes no futuro', count(*) FROM movimentacao WHERE data_movimentacao > now() OR created_at > now()
UNION ALL
SELECT 'bloqueios de lote no futuro', count(*) FROM lote WHERE data_bloqueio > now()
UNION ALL
SELECT 'lotes com data de fabricacao no futuro', count(*) FROM lote WHERE data_fabricacao > current_date
UNION ALL
SELECT 'triggers esperados ausentes ou desabilitados', count(*)
FROM unnest(ARRAY['trg_auditoria_lote', 'trg_auditoria_movimentacao', 'trg_auditoria_usuario', 'trg_bloquear_saida']) AS esperado(nome)
WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgname = esperado.nome AND t.tgenabled = 'O' AND NOT t.tgisinternal)
UNION ALL
SELECT 'lotes sem etiqueta (so na carga do seed)', CASE WHEN :checar_etiqueta = 1 THEN count(*) ELSE 0 END FROM lote l WHERE NOT EXISTS (SELECT 1 FROM identificacao i WHERE i.id_lote = l.id_lote)
UNION ALL
SELECT 'usuarios com hash que nao e bcrypt custo 12', count(*) FROM usuario WHERE senha_hash !~ '^[$]2b[$]12[$]';

SELECT verificacao, total AS violacoes FROM violacoes ORDER BY 1;

DO $assercao$
DECLARE
  v_falhas text;
BEGIN
  SELECT string_agg(verificacao || ' = ' || total, '; ') INTO v_falhas FROM violacoes WHERE total > 0;
  IF v_falhas IS NOT NULL THEN
    RAISE EXCEPTION 'Invariantes violados: %', v_falhas;
  END IF;
END
$assercao$;

SELECT 'INVARIANTES: OK' AS resultado;
