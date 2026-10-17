USE stockflow;

CREATE TABLE IF NOT EXISTS inventario (
  id                  INT            NOT NULL AUTO_INCREMENT,
  corredor            VARCHAR(10)    NOT NULL,
  id_usuario          INT            NOT NULL,
  itens               JSON           NULL,
  total_itens         INT            NOT NULL DEFAULT 0,
  total_posicoes      INT            NOT NULL DEFAULT 0,
  total_conferidas    INT            NOT NULL DEFAULT 0,
  total_divergencias  INT            NOT NULL DEFAULT 0,
  divergencias        INT            NOT NULL DEFAULT 0,
  acuracidade         DECIMAL(5,2)   NOT NULL DEFAULT 100.00,
  status              ENUM('em andamento','concluido') NOT NULL DEFAULT 'em andamento',
  etapa               ENUM('iniciado','contando','confirmado','finalizado') NOT NULL DEFAULT 'iniciado',
  observacao          TEXT           NULL,
  iniciado_em         DATETIME       NOT NULL DEFAULT NOW(),
  concluido_em        DATETIME       NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_inventario_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CALL sf_adicionar_coluna('inventario', 'itens', 'JSON NULL');
CALL sf_adicionar_coluna('inventario', 'total_divergencias', 'INT NOT NULL DEFAULT 0');
CALL sf_adicionar_coluna('inventario', 'total_itens', 'INT NOT NULL DEFAULT 0');
CALL sf_adicionar_coluna('inventario', 'etapa', 'ENUM(''iniciado'',''contando'',''confirmado'',''finalizado'') NOT NULL DEFAULT ''iniciado''');
CALL sf_adicionar_coluna('usuario', 'permissoes', 'JSON NULL');
CALL sf_adicionar_coluna('produto', 'sku_sap', 'VARCHAR(40) NULL');

DROP PROCEDURE sf_adicionar_coluna;

UPDATE inventario
SET etapa = CASE
  WHEN status = 'concluido' THEN 'finalizado'
  WHEN total_conferidas > 0 THEN 'contando'
  ELSE 'iniciado'
END
WHERE etapa IS NULL OR etapa = 'iniciado';

UPDATE inventario
SET total_itens = COALESCE(NULLIF(total_itens, 0), total_posicoes),
    total_divergencias = COALESCE(NULLIF(total_divergencias, 0), divergencias);
