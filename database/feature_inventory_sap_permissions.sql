USE stockflow;

ALTER TABLE inventario
  ADD COLUMN IF NOT EXISTS itens JSON NULL COMMENT 'Array de { id_lote, qtd_sistema, qtd_contada, divergencia }',
  ADD COLUMN IF NOT EXISTS total_divergencias INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_itens INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS etapa ENUM('iniciado','contando','confirmado','finalizado') NOT NULL DEFAULT 'iniciado';

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS permissoes JSON NULL COMMENT 'Permissões customizadas além do perfil padrão';

ALTER TABLE produto
  ADD COLUMN IF NOT EXISTS sku_sap VARCHAR(40) NULL;

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
