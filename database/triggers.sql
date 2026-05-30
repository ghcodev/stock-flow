DROP TRIGGER IF EXISTS trg_audit_movimentacao;
DROP TRIGGER IF EXISTS trg_audit_lote_update;

CREATE TRIGGER trg_audit_movimentacao
AFTER INSERT ON movimentacao
FOR EACH ROW
  INSERT INTO auditoria_log (tabela_afetada, operacao, valor_novo, id_usuario, ip_usuario)
  VALUES (
    'movimentacao',
    'INSERT',
    JSON_OBJECT('descricao', COALESCE(NEW.observacao, NEW.motivo_movimentacao, NEW.tipo), 'quantidade', NEW.quantidade, 'id_lote', NEW.id_lote),
    NEW.id_usuario,
    COALESCE(NULLIF(@audit_ip, ''), 'interno')
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
      JSON_OBJECT('campo', 'quantidade', 'valor', OLD.quantidade, 'lote', OLD.numero_lote),
      JSON_OBJECT('campo', 'quantidade', 'valor', NEW.quantidade, 'lote', NEW.numero_lote),
      @audit_user_id,
      COALESCE(NULLIF(@audit_ip, ''), 'interno')
    );
  END IF;
END$$
DELIMITER ;
