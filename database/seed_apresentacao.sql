-- ============================================================
-- StockFlow — Seed de Apresentação Acadêmica
-- ============================================================
-- Objetivo  : Popular o Dashboard com dados ricos dos últimos 30 dias
-- Segurança : Idempotente — cada linha usa observacao como chave única
--             INSERT ... WHERE NOT EXISTS evita duplicatas em re-execuções
-- Execução  : mysql -u root -pStockflow@2026 stockflow < database/seed_apresentacao.sql
-- ============================================================

USE stockflow;

SET @audit_user_id = NULL;
SET @audit_ip      = 'seed_apresentacao';
SET @audit_op      = 'INSERT';

-- ============================================================
-- DIAGNÓSTICO INICIAL — IDs existentes no banco
-- ============================================================
SELECT 'Produtos ativos:'  AS info, COUNT(*) AS total FROM produto  WHERE ativo = 1;
SELECT 'Lotes ativos:'     AS info, COUNT(*) AS total FROM lote     WHERE status_lote = 'ativo';
SELECT 'Usuários ativos:'  AS info, COUNT(*) AS total FROM usuario  WHERE ativo = 1;
SELECT 'Movs existentes:'  AS info, COUNT(*) AS total FROM movimentacao;

-- ============================================================
-- DIA 0 — HOJE (8 movimentações: 5E 2S 1T)
-- ============================================================

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 300, 2, 4, 2,
  'Produção extra — Pão Francês Boleado turno manhã', 'SEED-APRES-D00-01',
  DATE_ADD(CURDATE(), INTERVAL 8 HOUR), DATE_ADD(CURDATE(), INTERVAL 8 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D00-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 180, 8, 3, 8,
  'Pão de Leite — lote matinal', 'SEED-APRES-D00-02',
  DATE_ADD(CURDATE(), INTERVAL 9 HOUR), DATE_ADD(CURDATE(), INTERVAL 9 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D00-02');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 250, 33, 5, 390,
  'Enroladinho de Queijo — produção', 'SEED-APRES-D00-03',
  DATE_ADD(CURDATE(), INTERVAL 10 HOUR), DATE_ADD(CURDATE(), INTERVAL 10 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D00-03');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 90, 2, 6,
  'Distribuição rede varejista — Goiânia Centro', 'SEED-APRES-D00-04',
  DATE_ADD(CURDATE(), INTERVAL 11 HOUR), DATE_ADD(CURDATE(), INTERVAL 11 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D00-04');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 60, 15, 9,
  'Pedido supermercado parceiro — Pão de Queijo Gourmet', 'SEED-APRES-D00-05',
  DATE_ADD(CURDATE(), INTERVAL 12 HOUR), DATE_ADD(CURDATE(), INTERVAL 12 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D00-05');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'transferencia', 80, 10, 11, 98, 99,
  'Reorganização câmara fria CF02-A', 'SEED-APRES-D00-06',
  DATE_ADD(CURDATE(), INTERVAL 13 HOUR), DATE_ADD(CURDATE(), INTERVAL 13 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D00-06');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 200, 34, 10, 391,
  'Esfirra de Carne — turno tarde', 'SEED-APRES-D00-07',
  DATE_ADD(CURDATE(), INTERVAL 14 HOUR), DATE_ADD(CURDATE(), INTERVAL 14 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D00-07');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 150, 27, 4, 193,
  'Quibe Recheado Catupiri — lote vespertino', 'SEED-APRES-D00-08',
  DATE_ADD(CURDATE(), INTERVAL 15 HOUR), DATE_ADD(CURDATE(), INTERVAL 15 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D00-08');

-- ============================================================
-- DIA 1 — ONTEM (6 movimentações: 4E 1S 1T)
-- ============================================================

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 400, 2, 3, 1,
  'Produção Pão Francês Boleado — lote A', 'SEED-APRES-D01-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL 7 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL 7 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D01-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 220, 28, 5, 385,
  'Pastel Congelado — produção', 'SEED-APRES-D01-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL 9 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL 9 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D01-02');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 160, 30, 11, 387,
  'Bolinha de Queijo — entrada câmara ES01', 'SEED-APRES-D01-03',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL 11 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL 11 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D01-03');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 110, 2, 6,
  'Entrega distribuidora — Aparecida de Goiânia', 'SEED-APRES-D01-04',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL 14 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL 14 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D01-04');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'transferencia', 60, 27, 9, 193, 194,
  'Transferência Quibe — otimização corredor CF03', 'SEED-APRES-D01-05',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL 16 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL 16 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D01-05');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 130, 40, 10, 481,
  'Massa Doce Tradicional — entrada câmara ES02', 'SEED-APRES-D01-06',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL 17 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL 17 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D01-06');

-- ============================================================
-- DIA 2 (5 movimentações: 3E 1S 1T)
-- ============================================================

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 350, 2, 4, 3,
  'Pão Francês Boleado — produção lote B', 'SEED-APRES-D02-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 2 DAY), INTERVAL 8 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 2 DAY), INTERVAL 8 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D02-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 190, 41, 3, 482,
  'Massa Doce Recheada — entrada', 'SEED-APRES-D02-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 2 DAY), INTERVAL 10 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 2 DAY), INTERVAL 10 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D02-02');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 75, 28, 6,
  'Saída Pastel — cliente restaurante', 'SEED-APRES-D02-03',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 2 DAY), INTERVAL 12 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 2 DAY), INTERVAL 12 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D02-03');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'transferencia', 100, 34, 11, 391, 392,
  'Transferência Esfirra — balanceamento ES01', 'SEED-APRES-D02-04',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 2 DAY), INTERVAL 14 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 2 DAY), INTERVAL 14 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D02-04');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 120, 5, 9, 5,
  'Pão de Batata Congelado — lote produção', 'SEED-APRES-D02-05',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 2 DAY), INTERVAL 16 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 2 DAY), INTERVAL 16 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D02-05');

-- ============================================================
-- DIA 3 (5 movimentações: 3E 1S 1T)
-- ============================================================

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 280, 15, 4, 102,
  'Pão de Queijo Gourmet — produção grande lote', 'SEED-APRES-D03-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 3 DAY), INTERVAL 7 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 3 DAY), INTERVAL 7 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D03-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 200, 3, 5, 3,
  'Baguete Congelada — produção turno A', 'SEED-APRES-D03-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 3 DAY), INTERVAL 9 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 3 DAY), INTERVAL 9 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D03-02');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 85, 15, 6,
  'Distribuição padarias — região Norte', 'SEED-APRES-D03-03',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 3 DAY), INTERVAL 11 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 3 DAY), INTERVAL 11 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D03-03');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'transferencia', 70, 2, 10, 2, 4,
  'Remanejamento CF01-A — abertura corredor', 'SEED-APRES-D03-04',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 3 DAY), INTERVAL 14 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 3 DAY), INTERVAL 14 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D03-04');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 140, 7, 9, 7,
  'Pão de Milho Congelado — chegada lote', 'SEED-APRES-D03-05',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 3 DAY), INTERVAL 16 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 3 DAY), INTERVAL 16 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D03-05');

-- ============================================================
-- DIA 4 (4 movimentações: 2E 1S 1J)
-- ============================================================

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 320, 2, 3, 6,
  'Pão Francês Boleado — turno noturno', 'SEED-APRES-D04-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 4 DAY), INTERVAL 6 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 4 DAY), INTERVAL 6 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D04-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 170, 30, 4, 388,
  'Bolinha de Queijo — produção', 'SEED-APRES-D04-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 4 DAY), INTERVAL 10 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 4 DAY), INTERVAL 10 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D04-02');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 55, 30, 11,
  'Venda direta — evento corporativo', 'SEED-APRES-D04-03',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 4 DAY), INTERVAL 13 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 4 DAY), INTERVAL 13 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D04-03');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'ajuste', 15, 15, 7,
  'Ajuste de inventário — divergência contagem física CF02-A', 'SEED-APRES-D04-04',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 4 DAY), INTERVAL 15 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 4 DAY), INTERVAL 15 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D04-04');

-- ============================================================
-- DIA 5 (4 movimentações: 2E 1S 1T)
-- ============================================================

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 260, 8, 5, 8,
  'Pão de Leite — lote produção tarde', 'SEED-APRES-D05-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 5 DAY), INTERVAL 8 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 5 DAY), INTERVAL 8 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D05-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 180, 4, 9, 4,
  'Pão Integral — chegada lote quinzenal', 'SEED-APRES-D05-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 5 DAY), INTERVAL 11 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 5 DAY), INTERVAL 11 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D05-02');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 95, 8, 6,
  'Distribuição lanchonetes — Anápolis', 'SEED-APRES-D05-03',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 5 DAY), INTERVAL 14 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 5 DAY), INTERVAL 14 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D05-03');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'transferencia', 90, 40, 10, 481, 482,
  'Transferência Massa Doce — reequilíbrio ES02', 'SEED-APRES-D05-04',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 5 DAY), INTERVAL 16 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 5 DAY), INTERVAL 16 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D05-04');

-- ============================================================
-- DIA 6 (3 movimentações: 2E 1S)
-- ============================================================

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 310, 2, 4, 7,
  'Pão Francês Boleado — produção semanal', 'SEED-APRES-D06-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 6 DAY), INTERVAL 7 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 6 DAY), INTERVAL 7 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D06-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 70, 3, 11,
  'Saída Baguete — cliente cafeteria', 'SEED-APRES-D06-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 6 DAY), INTERVAL 10 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 6 DAY), INTERVAL 10 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D06-02');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 140, 35, 5, 392,
  'Mini Cachorro Quente — entrada câmara', 'SEED-APRES-D06-03',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 6 DAY), INTERVAL 15 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 6 DAY), INTERVAL 15 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D06-03');

-- ============================================================
-- DIAS 7 a 10 (3 movimentações cada)
-- ============================================================

-- Dia 7
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 290, 2, 3, 9,
  'Pão Francês Boleado — lote semanal', 'SEED-APRES-D07-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 7 DAY), INTERVAL 8 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 7 DAY), INTERVAL 8 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D07-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 80, 27, 6,
  'Distribuição Quibe — interior Goiás', 'SEED-APRES-D07-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 7 DAY), INTERVAL 11 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 7 DAY), INTERVAL 11 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D07-02');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 160, 32, 9, 389,
  'Enroladinho de Salsicha — produção', 'SEED-APRES-D07-03',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 7 DAY), INTERVAL 14 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 7 DAY), INTERVAL 14 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D07-03');

-- Dia 8
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 240, 15, 4, 103,
  'Pão de Queijo Gourmet — entrada', 'SEED-APRES-D08-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 8 DAY), INTERVAL 9 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 8 DAY), INTERVAL 9 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D08-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 65, 15, 11,
  'Pedido distribuidora — região Leste', 'SEED-APRES-D08-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 8 DAY), INTERVAL 13 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 8 DAY), INTERVAL 13 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D08-02');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 130, 6, 10, 6,
  'Pão Hot Dog — lote produção', 'SEED-APRES-D08-03',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 8 DAY), INTERVAL 16 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 8 DAY), INTERVAL 16 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D08-03');

-- Dia 9
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 210, 2, 3, 10,
  'Pão Francês Boleado — produção extra', 'SEED-APRES-D09-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 9 DAY), INTERVAL 8 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 9 DAY), INTERVAL 8 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D09-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 175, 42, 5, 483,
  'Massa Doce Chocolate — entrada', 'SEED-APRES-D09-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 9 DAY), INTERVAL 14 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 9 DAY), INTERVAL 14 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D09-02');

-- Dia 10
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 195, 9, 4, 97,
  'Pão Dourado — produção quinzenal', 'SEED-APRES-D10-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 10 DAY), INTERVAL 9 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 10 DAY), INTERVAL 9 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D10-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 50, 42, 6,
  'Venda direta — confeitaria parceira', 'SEED-APRES-D10-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 10 DAY), INTERVAL 15 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 10 DAY), INTERVAL 15 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D10-02');

-- ============================================================
-- DIAS 11 a 14 (2 movimentações cada)
-- ============================================================

-- Dia 11
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 360, 2, 9, 11,
  'Pão Francês Boleado — produção semanal', 'SEED-APRES-D11-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 11 DAY), INTERVAL 7 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 11 DAY), INTERVAL 7 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D11-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 100, 2, 11,
  'Saída bulk — cliente supermercado rede', 'SEED-APRES-D11-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 11 DAY), INTERVAL 13 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 11 DAY), INTERVAL 13 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D11-02');

-- Dia 12
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 220, 38, 4, 395,
  'Empadinha de Frango — produção', 'SEED-APRES-D12-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 12 DAY), INTERVAL 8 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 12 DAY), INTERVAL 8 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D12-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 45, 38, 10,
  'Entrega cliente — padaria artesanal', 'SEED-APRES-D12-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 12 DAY), INTERVAL 14 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 12 DAY), INTERVAL 14 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D12-02');

-- Dia 13
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 270, 14, 5, 102,
  'Pão de Queijo Tradicional — produção', 'SEED-APRES-D13-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 13 DAY), INTERVAL 9 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 13 DAY), INTERVAL 9 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D13-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'transferencia', 55, 14, 9, 102, 103,
  'Reposição Pão de Queijo — corredor CF02-B', 'SEED-APRES-D13-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 13 DAY), INTERVAL 15 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 13 DAY), INTERVAL 15 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D13-02');

-- Dia 14
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 330, 2, 3, 12,
  'Pão Francês Boleado — quinzena', 'SEED-APRES-D14-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 14 DAY), INTERVAL 7 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 14 DAY), INTERVAL 7 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D14-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 155, 36, 10, 393,
  'Tortinha de Frango — entrada câmara ES01', 'SEED-APRES-D14-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 14 DAY), INTERVAL 13 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 14 DAY), INTERVAL 13 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D14-02');

-- ============================================================
-- DIAS 15 a 20 (2 movimentações cada)
-- ============================================================

-- Dia 15
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 300, 2, 4, 13,
  'Pão Francês Boleado — lote quinzenal A', 'SEED-APRES-D15-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 15 DAY), INTERVAL 8 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 15 DAY), INTERVAL 8 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D15-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 75, 35, 6,
  'Mini Cachorro Quente — pedido escola parceira', 'SEED-APRES-D15-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 15 DAY), INTERVAL 14 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 15 DAY), INTERVAL 14 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D15-02');

-- Dia 16
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 190, 37, 5, 394,
  'Mini Americano — entrada câmara fria', 'SEED-APRES-D16-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 16 DAY), INTERVAL 9 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 16 DAY), INTERVAL 9 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D16-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 60, 37, 9,
  'Saída Mini Americano — buffet evento', 'SEED-APRES-D16-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 16 DAY), INTERVAL 14 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 16 DAY), INTERVAL 14 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D16-02');

-- Dia 17
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 230, 2, 11, 14,
  'Pão Francês Boleado — reposição câmara', 'SEED-APRES-D17-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 17 DAY), INTERVAL 8 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 17 DAY), INTERVAL 8 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D17-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 145, 31, 3, 388,
  'Croquete de Salsicha — produção', 'SEED-APRES-D17-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 17 DAY), INTERVAL 13 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 17 DAY), INTERVAL 13 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D17-02');

-- Dia 18
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 280, 1, 4, 1,
  'Pão Francês Congelado — reposição mensal', 'SEED-APRES-D18-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 18 DAY), INTERVAL 7 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 18 DAY), INTERVAL 7 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D18-01');

-- Dia 19
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'saida', 120, 2, 6,
  'Distribuição mensal — rede supermercados Goiânia', 'SEED-APRES-D19-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 19 DAY), INTERVAL 10 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 19 DAY), INTERVAL 10 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D19-01');

-- Dia 20
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 260, 43, 5, 484,
  'Massa Doce Integral — entrada ES02', 'SEED-APRES-D20-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 20 DAY), INTERVAL 8 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 20 DAY), INTERVAL 8 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D20-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'transferencia', 75, 43, 9, 484, 481,
  'Transferência Massa Doce — otimização ES02', 'SEED-APRES-D20-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 20 DAY), INTERVAL 15 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 20 DAY), INTERVAL 15 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D20-02');

-- ============================================================
-- DIAS 21 a 29 (1-2 movimentações cada)
-- ============================================================

-- Dia 21
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 380, 2, 3, 15,
  'Pão Francês Boleado — lote mensal', 'SEED-APRES-D21-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 21 DAY), INTERVAL 7 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 21 DAY), INTERVAL 7 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D21-01');

-- Dia 22
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 170, 29, 4, 386,
  'Churros Congelado — produção', 'SEED-APRES-D22-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 22 DAY), INTERVAL 10 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 22 DAY), INTERVAL 10 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D22-01');

-- Dia 23
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 210, 10, 5, 98,
  'Rosca de Chocolate — entrada câmara CF02', 'SEED-APRES-D23-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 23 DAY), INTERVAL 9 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 23 DAY), INTERVAL 9 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D23-01');

-- Dia 24
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 250, 13, 9, 101,
  'Rosca Trancinha — produção mensal', 'SEED-APRES-D24-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 24 DAY), INTERVAL 8 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 24 DAY), INTERVAL 8 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D24-01');

INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'ajuste', 20, 13, 7,
  'Ajuste contagem — divergência inventário câmara CF02-D', 'SEED-APRES-D24-02',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 24 DAY), INTERVAL 15 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 24 DAY), INTERVAL 15 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D24-02');

-- Dia 25
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 290, 2, 11, 16,
  'Pão Francês Boleado — lote mês anterior', 'SEED-APRES-D25-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 25 DAY), INTERVAL 7 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 25 DAY), INTERVAL 7 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D25-01');

-- Dia 26
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 160, 26, 4, 197,
  'Coxinha Congelada — produção câmara CF03', 'SEED-APRES-D26-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 26 DAY), INTERVAL 9 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 26 DAY), INTERVAL 9 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D26-01');

-- Dia 27
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 200, 11, 5, 99,
  'Rosca Húngara — produção semanal', 'SEED-APRES-D27-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 27 DAY), INTERVAL 8 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 27 DAY), INTERVAL 8 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D27-01');

-- Dia 28
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 320, 2, 3, 17,
  'Pão Francês Boleado — início período 30d', 'SEED-APRES-D28-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 28 DAY), INTERVAL 7 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 28 DAY), INTERVAL 7 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D28-01');

-- Dia 29
INSERT INTO movimentacao
  (tipo, quantidade, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao, observacao, data_movimentacao, criado_em, status)
SELECT 'entrada', 180, 12, 9, 100,
  'Rosca Redonda — entrada câmara CF02-A', 'SEED-APRES-D29-01',
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 29 DAY), INTERVAL 9 HOUR),
  DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 29 DAY), INTERVAL 9 HOUR), 'concluida'
WHERE NOT EXISTS (SELECT 1 FROM movimentacao WHERE observacao = 'SEED-APRES-D29-01');

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
SELECT 'RESULTADO SEED APRESENTACAO' AS status;

SELECT tipo, COUNT(*) AS total
FROM movimentacao
GROUP BY tipo
ORDER BY total DESC;

SELECT DATE(criado_em) AS dia, COUNT(*) AS movs,
  SUM(CASE WHEN tipo='entrada'     THEN 1 ELSE 0 END) AS entradas,
  SUM(CASE WHEN tipo='saida'       THEN 1 ELSE 0 END) AS saidas,
  SUM(CASE WHEN tipo='transferencia' THEN 1 ELSE 0 END) AS transf,
  SUM(CASE WHEN tipo='ajuste'      THEN 1 ELSE 0 END) AS ajustes
FROM movimentacao
WHERE criado_em >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(criado_em)
ORDER BY dia DESC
LIMIT 15;

SELECT
  SUM(CASE WHEN DATE(criado_em) = CURDATE() THEN 1 ELSE 0 END)                              AS movs_hoje,
  SUM(CASE WHEN criado_em >= DATE_SUB(CURDATE(), INTERVAL 7  DAY) THEN 1 ELSE 0 END)        AS movs_7_dias,
  SUM(CASE WHEN criado_em >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END)        AS movs_30_dias,
  COUNT(*) AS total_geral
FROM movimentacao;
