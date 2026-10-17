\set ON_ERROR_STOP 1
BEGIN;
SELECT set_config('app.user_id', (SELECT id_usuario::text FROM usuario WHERE email = 'admin@stockflow.local'), true),
       set_config('app.ip', :'ip', true) \gset
DO $$
DECLARE
  v_lote INTEGER;
  v_usuario INTEGER;
  v_saldo NUMERIC(12,3);
  v_qtd NUMERIC(12,3) := 50;
BEGIN
  SELECT id_usuario INTO v_usuario FROM usuario WHERE email = 'admin@stockflow.local';
  SELECT id_lote, quantidade INTO v_lote, v_saldo FROM lote WHERE numero_lote = 'L-002' FOR UPDATE;
  PERFORM pg_sleep(1.5);
  IF v_saldo < v_qtd THEN
    RAISE EXCEPTION 'Saldo insuficiente: saldo %, solicitado %', v_saldo, v_qtd;
  END IF;
  UPDATE lote SET quantidade = quantidade - v_qtd WHERE id_lote = v_lote;
  INSERT INTO movimentacao (tipo_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario)
  VALUES ('saida', v_qtd, v_saldo, v_saldo - v_qtd, v_lote, v_usuario);
  RAISE NOTICE 'Saída concluída: saldo % -> %', v_saldo, v_saldo - v_qtd;
END $$;
COMMIT;
