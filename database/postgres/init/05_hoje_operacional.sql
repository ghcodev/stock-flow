CREATE OR REPLACE FUNCTION hoje_operacional(instante timestamptz DEFAULT now()) RETURNS date AS $$
  SELECT (instante AT TIME ZONE 'America/Sao_Paulo')::date
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION fn_bloquear_saida() RETURNS trigger AS $$
BEGIN
  IF NEW.tipo_movimentacao = 'saida' AND EXISTS (
    SELECT 1 FROM lote WHERE id_lote = NEW.id_lote AND (status_lote IN ('vencido', 'bloqueado') OR data_validade < hoje_operacional())
  ) THEN
    RAISE EXCEPTION 'Saída não permitida para lote vencido, com validade expirada ou bloqueado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $concessao$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stockflow_app') THEN
    GRANT EXECUTE ON FUNCTION hoje_operacional(timestamptz) TO stockflow_app;
  END IF;
END
$concessao$;
