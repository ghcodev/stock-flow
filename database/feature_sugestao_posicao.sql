DROP PROCEDURE IF EXISTS sf_adicionar_coluna;

DELIMITER $$

CREATE PROCEDURE sf_adicionar_coluna(
  IN p_tabela    VARCHAR(64),
  IN p_coluna    VARCHAR(64),
  IN p_definicao VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_tabela
      AND COLUMN_NAME = p_coluna
  ) THEN
    SET @sf_ddl = CONCAT('ALTER TABLE `', p_tabela, '` ADD COLUMN `', p_coluna, '` ', p_definicao);
    PREPARE sf_stmt FROM @sf_ddl;
    EXECUTE sf_stmt;
    DEALLOCATE PREPARE sf_stmt;
  END IF;
END$$

DELIMITER ;

CALL sf_adicionar_coluna('localizacao', 'capacidade', 'DECIMAL(12,3) NULL');
CALL sf_adicionar_coluna('localizacao', 'tipo_zona', 'ENUM(''seco'',''refrigerado'',''quimico'') NOT NULL DEFAULT ''seco''');
CALL sf_adicionar_coluna('localizacao', 'distancia_expedicao', 'INT NOT NULL DEFAULT 0');
CALL sf_adicionar_coluna('produto', 'tipo_armazenagem', 'ENUM(''seco'',''refrigerado'',''quimico'') NOT NULL DEFAULT ''seco''');
CALL sf_adicionar_coluna('produto', 'peso_unitario_kg', 'DECIMAL(10,3) NULL');

DROP PROCEDURE sf_adicionar_coluna;

UPDATE localizacao AS l
JOIN (
  SELECT id, DENSE_RANK() OVER (ORDER BY corredor, posicao) AS distancia
  FROM localizacao
) AS ordem ON ordem.id = l.id
SET l.distancia_expedicao = ordem.distancia
WHERE l.distancia_expedicao = 0;
