-- StockFlow - ocupacao visual do mapa do armazem
-- Seguro para reexecucao: usa INSERT IGNORE e numero_lote deterministico por localizacao.
-- Nao atualiza nem remove dados existentes.

INSERT IGNORE INTO lote (
  numero_lote,
  data_fabricacao,
  data_validade,
  quantidade,
  id_produto,
  id_localizacao,
  status_lote,
  criado_em
)
WITH
metas AS (
  SELECT 'CF01' AS zona, 0.70 AS pct_meta UNION ALL
  SELECT 'CF02', 0.60 UNION ALL
  SELECT 'CF03', 0.50 UNION ALL
  SELECT 'CF04', 0.45 UNION ALL
  SELECT 'ES01', 0.40 UNION ALL
  SELECT 'ES02', 0.35
),
ocupacao_atual AS (
  SELECT
    LEFT(l.corredor, 4) AS zona,
    COUNT(DISTINCT l.id) AS total_posicoes,
    COUNT(DISTINCT CASE WHEN lt.id IS NOT NULL THEN l.id END) AS ocupadas
  FROM localizacao l
  LEFT JOIN lote lt
    ON lt.id_localizacao = l.id
   AND lt.quantidade > 0
  GROUP BY LEFT(l.corredor, 4)
),
localizacoes_vazias AS (
  SELECT
    l.id,
    l.corredor,
    l.nivel,
    l.posicao,
    LEFT(l.corredor, 4) AS zona,
    ROW_NUMBER() OVER (
      PARTITION BY LEFT(l.corredor, 4)
      ORDER BY l.corredor, l.nivel, l.posicao
    ) AS rn_zona
  FROM localizacao l
  LEFT JOIN lote lt
    ON lt.id_localizacao = l.id
   AND lt.quantidade > 0
  WHERE lt.id IS NULL
    AND LEFT(l.corredor, 4) IN ('CF01','CF02','CF03','CF04','ES01','ES02')
),
localizacoes_alvo AS (
  SELECT
    lv.*,
    ROW_NUMBER() OVER (ORDER BY lv.zona, lv.corredor, lv.nivel, lv.posicao) AS rn_global
  FROM localizacoes_vazias lv
  JOIN metas m ON m.zona = lv.zona
  JOIN ocupacao_atual oa ON oa.zona = lv.zona
  WHERE lv.rn_zona <= GREATEST(0, CEIL(oa.total_posicoes * m.pct_meta) - oa.ocupadas)
),
produtos AS (
  SELECT
    p.id,
    ROW_NUMBER() OVER (ORDER BY p.id) AS rn_produto
  FROM produto p
  WHERE p.ativo = 1
),
produto_total AS (
  SELECT COUNT(*) AS total FROM produtos
)
SELECT
  CONCAT('AT-MAPA-2026-', LPAD(la.id, 4, '0')) AS numero_lote,
  DATE_SUB(NOW(), INTERVAL (10 + MOD(la.id, 60)) DAY) AS data_fabricacao,
  DATE_ADD(NOW(), INTERVAL (30 + MOD(la.id * 7, 180)) DAY) AS data_validade,
  CAST(50 + MOD(la.id * 37, 450) AS DECIMAL(10,3)) AS quantidade,
  p.id AS id_produto,
  la.id AS id_localizacao,
  'ativo' AS status_lote,
  NOW() AS criado_em
FROM localizacoes_alvo la
CROSS JOIN produto_total pt
JOIN produtos p
  ON p.rn_produto = MOD(la.rn_global - 1, pt.total) + 1;
