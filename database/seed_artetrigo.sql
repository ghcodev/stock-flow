-- ============================================================
-- Seed: Catálogo real Arte Trigo — produtos congelados de Goiás
-- Executado em: 2026-05-28
-- ============================================================

USE stockflow;

-- ------------------------------------------------------------
-- ETAPA 1: Remover produtos genéricos de demonstração
-- ------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM movimentacao WHERE id_lote IN (
  SELECT id FROM lote WHERE id_produto IN (
    SELECT id FROM produto WHERE nome IN (
      'Brownie de Chocolate','Bolo de Cenoura Fatia',
      'Açúcar Refinado 5kg','Manteiga 500g',
      'Leite Integral 1L','Ovos (caixa 30un)',
      'Fermento Biológico 500g','Farinha de Trigo 25kg',
      'Rosca de Coco','Pão Integral','Pão Sírio',
      'Croissant Presunto/Queijo','Enroladinho de Salsicha',
      'Pastel de Queijo','Produto Teste','Produto Teste 2'
    )
  )
);

DELETE FROM identificacao WHERE id_lote IN (
  SELECT id FROM lote WHERE id_produto IN (
    SELECT id FROM produto WHERE nome IN (
      'Brownie de Chocolate','Bolo de Cenoura Fatia',
      'Açúcar Refinado 5kg','Manteiga 500g',
      'Leite Integral 1L','Ovos (caixa 30un)',
      'Fermento Biológico 500g','Farinha de Trigo 25kg',
      'Rosca de Coco','Pão Integral','Pão Sírio',
      'Croissant Presunto/Queijo','Enroladinho de Salsicha',
      'Pastel de Queijo','Produto Teste','Produto Teste 2'
    )
  )
);

DELETE FROM lote WHERE id_produto IN (
  SELECT id FROM produto WHERE nome IN (
    'Brownie de Chocolate','Bolo de Cenoura Fatia',
    'Açúcar Refinado 5kg','Manteiga 500g',
    'Leite Integral 1L','Ovos (caixa 30un)',
    'Fermento Biológico 500g','Farinha de Trigo 25kg',
    'Rosca de Coco','Pão Integral','Pão Sírio',
    'Croissant Presunto/Queijo','Enroladinho de Salsicha',
    'Pastel de Queijo','Produto Teste','Produto Teste 2'
  )
);

DELETE FROM produto WHERE nome IN (
  'Brownie de Chocolate','Bolo de Cenoura Fatia',
  'Açúcar Refinado 5kg','Manteiga 500g',
  'Leite Integral 1L','Ovos (caixa 30un)',
  'Fermento Biológico 500g','Farinha de Trigo 25kg',
  'Rosca de Coco','Pão Integral','Pão Sírio',
  'Croissant Presunto/Queijo','Enroladinho de Salsicha',
  'Pastel de Queijo','Produto Teste','Produto Teste 2'
);

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- ETAPA 2: Catálogo real Arte Trigo (14 produtos em 4 linhas)
-- ------------------------------------------------------------
INSERT INTO produto (nome, categoria, unidade_medida, estoque_minimo, ativo)
VALUES
  ('Pão Francês Congelado',       'Pães',      'unidade', 500, TRUE),
  ('Pão Francês Boleado',         'Pães',      'unidade', 300, TRUE),
  ('Pão de Batata Recheado',      'Pães',      'unidade', 200, TRUE),
  ('Pão de Leite',                'Pães',      'unidade', 200, TRUE),
  ('Pão para Hot Dog',            'Pães',      'pacote',  150, TRUE),
  ('Risole de Queijo',            'Salgados',  'unidade', 200, TRUE),
  ('Risole de Carne',             'Salgados',  'unidade', 200, TRUE),
  ('Quibe Recheado',              'Salgados',  'unidade', 200, TRUE),
  ('Empadinha de Frango',         'Salgados',  'unidade', 150, TRUE),
  ('Biscoito de Polvilho Assado', 'Quitandas', 'pacote',  100, TRUE),
  ('Rosca de Polvilho',           'Quitandas', 'pacote',  100, TRUE),
  ('Massa para Pastel',           'Massas',    'pacote',   80, TRUE),
  ('Massa para Empadão',          'Massas',    'pacote',   80, TRUE),
  ('Massa Folhada',               'Massas',    'pacote',   60, TRUE);

-- ------------------------------------------------------------
-- ETAPA 3: Lotes AT-* (congelados: validade 6-12 meses)
-- ------------------------------------------------------------
SET @pao_frances   = (SELECT id FROM produto WHERE nome = 'Pão Francês Congelado'      LIMIT 1);
SET @pao_boleado   = (SELECT id FROM produto WHERE nome = 'Pão Francês Boleado'         LIMIT 1);
SET @pao_queijo    = (SELECT id FROM produto WHERE nome = 'Pão de Queijo GG'            LIMIT 1);
SET @coxinha       = (SELECT id FROM produto WHERE nome = 'Coxinha de Frango'           LIMIT 1);
SET @risole_queijo = (SELECT id FROM produto WHERE nome = 'Risole de Queijo'            LIMIT 1);
SET @biscoito      = (SELECT id FROM produto WHERE nome = 'Biscoito de Polvilho Assado' LIMIT 1);
SET @pao_mel       = (SELECT id FROM produto WHERE nome = 'Pão de Mel'                  LIMIT 1);
SET @massa_pastel  = (SELECT id FROM produto WHERE nome = 'Massa para Pastel'           LIMIT 1);

INSERT INTO lote (numero_lote, data_fabricacao, data_validade, quantidade, id_produto, id_localizacao, status_lote)
VALUES
  ('AT-PAO-2026-001', '2026-05-01', '2026-11-01',  280, @pao_frances,   1, 'ativo'),
  ('AT-PAO-2026-002', '2026-05-10', '2026-11-10',  280, @pao_boleado,   2, 'ativo'),
  ('AT-QJO-2026-001', '2026-05-05', '2026-12-05',  290, @pao_queijo,    3, 'ativo'),
  ('AT-SAL-2026-001', '2026-05-15', '2026-11-15',  200, @coxinha,       4, 'ativo'),
  ('AT-SAL-2026-002', '2026-05-20', '2026-11-20',  150, @risole_queijo, 1, 'ativo'),
  ('AT-QUI-2026-001', '2026-04-01', '2026-10-01',   45, @biscoito,      2, 'ativo'),
  ('AT-QUI-2026-002', '2026-05-01', '2026-08-01',   95, @pao_mel,       3, 'ativo'),
  ('AT-MAS-2026-001', '2026-05-10', '2026-12-10',   65, @massa_pastel,  4, 'ativo');

INSERT INTO identificacao (tipo, codigo, id_lote)
SELECT 'RFID',
  CONCAT('AT-RF-', LPAD(l.id, 3, '0'), '-', SUBSTRING(l.numero_lote, 4, 3)),
  l.id
FROM lote l
WHERE l.numero_lote LIKE 'AT-%'
  AND l.id NOT IN (SELECT id_lote FROM identificacao);

-- ------------------------------------------------------------
-- ETAPA 4: Movimentações — produção e distribuição
-- ------------------------------------------------------------
INSERT INTO movimentacao (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, observacao, data_movimentacao, status)
SELECT 'entrada', l.quantidade, l.id, 1, l.id_localizacao,
  CONCAT('Produção lote ', l.numero_lote),
  DATE_SUB(NOW(), INTERVAL (FLOOR(RAND() * 15) + 1) DAY),
  'concluida'
FROM lote l WHERE l.numero_lote LIKE 'AT-%';

INSERT INTO movimentacao (tipo, quantidade, id_lote, id_usuario, observacao, data_movimentacao, status)
VALUES
  ('saida', 120, (SELECT id FROM lote WHERE numero_lote='AT-PAO-2026-001'),
   4, 'Distribuição rede de panificadoras — Goiânia Centro',   DATE_SUB(NOW(), INTERVAL 10 DAY), 'concluida'),
  ('saida',  80, (SELECT id FROM lote WHERE numero_lote='AT-PAO-2026-001'),
   4, 'Distribuição — Aparecida de Goiânia',                   DATE_SUB(NOW(), INTERVAL  7 DAY), 'concluida'),
  ('saida',  60, (SELECT id FROM lote WHERE numero_lote='AT-QJO-2026-001'),
   4, 'Distribuição Pão de Queijo — região metropolitana',     DATE_SUB(NOW(), INTERVAL  5 DAY), 'concluida'),
  ('saida',  90, (SELECT id FROM lote WHERE numero_lote='AT-SAL-2026-001'),
   2, 'Venda direta — cliente supermercado',                   DATE_SUB(NOW(), INTERVAL  3 DAY), 'concluida'),
  ('saida',  40, (SELECT id FROM lote WHERE numero_lote='AT-QUI-2026-001'),
   4, 'Distribuição biscoitos — interior de Goiás',            DATE_SUB(NOW(), INTERVAL  2 DAY), 'concluida'),
  ('saida',  30, (SELECT id FROM lote WHERE numero_lote='AT-SAL-2026-002'),
   2, 'Entrega cliente padaria parceira',                      DATE_SUB(NOW(), INTERVAL  1 DAY), 'concluida');

-- Atualizar saldos
UPDATE lote SET quantidade = quantidade - 120 WHERE numero_lote = 'AT-PAO-2026-001';
UPDATE lote SET quantidade = quantidade -  80 WHERE numero_lote = 'AT-PAO-2026-001';
UPDATE lote SET quantidade = quantidade -  60 WHERE numero_lote = 'AT-QJO-2026-001';
UPDATE lote SET quantidade = quantidade -  90 WHERE numero_lote = 'AT-SAL-2026-001';
UPDATE lote SET quantidade = quantidade -  40 WHERE numero_lote = 'AT-QUI-2026-001';
UPDATE lote SET quantidade = quantidade -  30 WHERE numero_lote = 'AT-SAL-2026-002';
