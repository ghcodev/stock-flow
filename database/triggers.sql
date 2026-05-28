DROP TRIGGER IF EXISTS trg_audit_movimentacao;
DROP TRIGGER IF EXISTS trg_audit_lote_update;

CREATE TRIGGER trg_audit_movimentacao
AFTER INSERT ON movimentacao
FOR EACH ROW
  INSERT INTO auditoria_log (tabela_afetada, operacao, valor_novo, id_usuario, ip_usuario)
  VALUES (
    'movimentacao',
    'INSERT',
    CONCAT('tipo:', NEW.tipo, ',qtd:', NEW.quantidade, ',lote:', NEW.id_lote),
    NEW.id_usuario,
    @audit_ip
  );

DELIMITER $$
CREATE TRIGGER trg_audit_lote_update
AFTER UPDATE ON lote
FOR EACH ROW
BEGIN
  IF NEW.quantidade <> OLD.quantidade THEN
    INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, ip_usuario)
    VALUES (
      'lote',
      IF(@audit_op = 'AJUSTE', 'AJUSTE', 'UPDATE'),
      CONCAT('quantidade:', OLD.quantidade),
      CONCAT('lote:', NEW.numero_lote, ',quantidade:', NEW.quantidade),
      @audit_user_id,
      @audit_ip
    );
  END IF;
END$$
DELIMITER ;
