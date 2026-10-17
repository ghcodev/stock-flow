CREATE OR REPLACE FUNCTION fn_auditoria() RETURNS trigger AS $$
DECLARE
  v_anterior JSONB;
  v_novo JSONB;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_anterior := to_jsonb(OLD) - 'senha_hash';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_novo := to_jsonb(NEW) - 'senha_hash';
  END IF;
  INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, ip_usuario)
  VALUES (
    TG_TABLE_NAME,
    TG_OP::operacao_auditoria,
    v_anterior,
    v_novo,
    NULLIF(current_setting('app.user_id', true), '')::INTEGER,
    NULLIF(current_setting('app.ip', true), '')::INET
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_lote
AFTER INSERT OR UPDATE OR DELETE ON lote
FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

CREATE TRIGGER trg_auditoria_movimentacao
AFTER INSERT ON movimentacao
FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

CREATE TRIGGER trg_auditoria_usuario
AFTER INSERT OR UPDATE ON usuario
FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

CREATE OR REPLACE FUNCTION fn_bloquear_saida() RETURNS trigger AS $$
BEGIN
  IF NEW.tipo_movimentacao = 'saida' AND EXISTS (
    SELECT 1 FROM lote WHERE id_lote = NEW.id_lote AND status_lote IN ('vencido', 'bloqueado')
  ) THEN
    RAISE EXCEPTION 'Saída não permitida para lote vencido ou bloqueado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloquear_saida
BEFORE INSERT ON movimentacao
FOR EACH ROW EXECUTE FUNCTION fn_bloquear_saida();
