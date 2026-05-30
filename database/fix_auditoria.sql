-- =============================================================
-- FIX AUDITORIA — Problemas 1 a 5
-- Tabela real: auditoria_log
-- Colunas: id, tabela_afetada, operacao, valor_anterior, valor_novo,
--          id_usuario, data_hora, ip_usuario
-- =============================================================

-- ---------------------------------------------------------------
-- PROBLEMA 1 — Remove prefixo ::ffff: do IP
-- ---------------------------------------------------------------
UPDATE auditoria_log
SET ip_usuario = REPLACE(ip_usuario, '::ffff:', '')
WHERE ip_usuario LIKE '::ffff:%';

SELECT ROW_COUNT() AS 'P1 — linhas corrigidas (IP ::ffff:)';

-- Verificação:
SELECT COUNT(*) AS 'P1 — deve ser 0 (IPs com ::ffff: restantes)'
FROM auditoria_log WHERE ip_usuario LIKE '::ffff:%';

-- ---------------------------------------------------------------
-- PROBLEMA 2 — Converte formato legado "chave:valor" para JSON
-- ---------------------------------------------------------------

-- LOGIN com formato "email:valor"
UPDATE auditoria_log
SET valor_novo = JSON_OBJECT('email', TRIM(SUBSTRING(valor_novo, INSTR(valor_novo, ':') + 1)), 'sucesso', CAST(1 AS JSON))
WHERE operacao = 'LOGIN'
  AND valor_novo NOT LIKE '{%'
  AND valor_novo LIKE 'email:%';

SELECT ROW_COUNT() AS 'P2a — linhas corrigidas (LOGIN formato legado)';

-- UPDATE de lote com formato "numero_lote:valor"
UPDATE auditoria_log
SET valor_novo = JSON_OBJECT('numero_lote', TRIM(SUBSTRING(valor_novo, INSTR(valor_novo, ':') + 1)))
WHERE tabela_afetada = 'lote'
  AND valor_novo NOT LIKE '{%'
  AND valor_novo LIKE 'numero_lote:%';

SELECT ROW_COUNT() AS 'P2b — linhas corrigidas (lote formato legado)';

-- Quaisquer outros registros com formato legado genérico "chave:valor"
UPDATE auditoria_log
SET valor_novo = JSON_OBJECT(
  TRIM(SUBSTRING_INDEX(valor_novo, ':', 1)),
  TRIM(SUBSTRING(valor_novo, INSTR(valor_novo, ':') + 1))
)
WHERE valor_novo NOT LIKE '{%'
  AND valor_novo NOT LIKE '[%'
  AND valor_novo IS NOT NULL
  AND valor_novo != ''
  AND valor_novo LIKE '%:%';

SELECT ROW_COUNT() AS 'P2c — linhas corrigidas (outros formatos legados)';

-- Verificação:
SELECT COUNT(*) AS 'P2 — deve ser 0 (registros fora de JSON)'
FROM auditoria_log
WHERE valor_novo NOT LIKE '{%'
  AND valor_novo NOT LIKE '[%'
  AND valor_novo IS NOT NULL
  AND valor_novo != '';

-- ---------------------------------------------------------------
-- PROBLEMA 3 — Remove campo ip duplicado do detalhe de LOGIN
-- ---------------------------------------------------------------
UPDATE auditoria_log
SET valor_novo = JSON_REMOVE(valor_novo, '$.ip')
WHERE operacao = 'LOGIN'
  AND JSON_VALID(valor_novo)
  AND JSON_EXTRACT(valor_novo, '$.ip') IS NOT NULL;

SELECT ROW_COUNT() AS 'P3 — linhas corrigidas (IP removido do detalhe LOGIN)';

-- Verificação:
SELECT COUNT(*) AS 'P3 — deve ser 0 (LOGIN com IP no detalhe)'
FROM auditoria_log
WHERE operacao = 'LOGIN'
  AND JSON_VALID(valor_novo)
  AND JSON_EXTRACT(valor_novo, '$.ip') IS NOT NULL;

-- ---------------------------------------------------------------
-- PROBLEMA 4 — Encoding quebrado nos registros de seed (IDs 2,5,6,7,10)
-- ---------------------------------------------------------------
UPDATE auditoria_log
SET valor_novo = JSON_OBJECT('descricao', 'Entrada producao Coxinha 800g - 200 pacotes turno tarde')
WHERE id = 2;

UPDATE auditoria_log
SET valor_novo = JSON_OBJECT('descricao', 'Remanejamento 60 pacotes CF-01 para CF-02')
WHERE id = 5;

UPDATE auditoria_log
SET valor_novo = JSON_OBJECT('lote', 'AT-SAL-2026-014', 'motivo', 'Bloqueio autorizado por Carlos Eduardo Matos - RN16')
WHERE id = 6;

UPDATE auditoria_log
SET valor_novo = JSON_OBJECT('descricao', 'Ajuste +15 pacotes Pao de Queijo Tradicional 800g')
WHERE id = 7;

UPDATE auditoria_log
SET valor_novo = JSON_OBJECT('descricao', 'Producao Pao Frances 1kg - manha 280 pacotes')
WHERE id = 10;

SELECT ROW_COUNT() AS 'P4 — ultimo UPDATE de encoding (ID 10)';

-- Verificação:
SELECT COUNT(*) AS 'P4 — deve ser 0 (textos com ? de encoding quebrado)'
FROM auditoria_log WHERE valor_novo LIKE '%??%';

-- ---------------------------------------------------------------
-- PROBLEMA 5 — Seed updates sem identificar o lote (Sistema, IDs 11-39)
-- ---------------------------------------------------------------
UPDATE auditoria_log
SET valor_novo = JSON_SET(valor_novo, '$.origem', 'seed_migracao', '$.lote', 'desconhecido')
WHERE tabela_afetada IN ('lote', 'movimentacao')
  AND id_usuario IS NULL
  AND JSON_VALID(valor_novo)
  AND JSON_EXTRACT(valor_novo, '$.lote') IS NULL
  AND JSON_EXTRACT(valor_novo, '$.origem') IS NULL;

SELECT ROW_COUNT() AS 'P5 — linhas marcadas como seed_migracao';

-- =============================================================
-- VERIFICAÇÕES FINAIS (todos devem retornar 0)
-- =============================================================
SELECT COUNT(*) AS 'FINAL P1 — IPs com ::ffff:'    FROM auditoria_log WHERE ip_usuario LIKE '::ffff:%';
SELECT COUNT(*) AS 'FINAL P2 — detalhes fora de JSON' FROM auditoria_log WHERE valor_novo NOT LIKE '{%' AND valor_novo NOT LIKE '[%' AND valor_novo IS NOT NULL AND valor_novo != '';
SELECT COUNT(*) AS 'FINAL P3 — LOGIN com IP no detalhe' FROM auditoria_log WHERE operacao = 'LOGIN' AND JSON_VALID(valor_novo) AND JSON_EXTRACT(valor_novo, '$.ip') IS NOT NULL;
SELECT COUNT(*) AS 'FINAL P4 — textos com encoding quebrado' FROM auditoria_log WHERE valor_novo LIKE '%??%';
