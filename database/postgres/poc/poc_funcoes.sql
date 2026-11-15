CREATE FUNCTION pg_temp.afirmar(p_condicao boolean, p_descricao text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_condicao IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHA: %', p_descricao;
  END IF;
  RAISE NOTICE 'OK: %', p_descricao;
END;
$$;

CREATE FUNCTION pg_temp.esperar_erro(p_sql text, p_estado text, p_trecho text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_mensagem text;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_mensagem = MESSAGE_TEXT;
    IF SQLSTATE <> p_estado OR (p_trecho IS NOT NULL AND position(p_trecho IN v_mensagem) = 0) THEN
      RAISE EXCEPTION 'FALHA: erro % (%) diferente do esperado % %', SQLSTATE, v_mensagem, p_estado, coalesce(p_trecho, '');
    END IF;
    RAISE NOTICE 'OK: erro esperado % (%)', SQLSTATE, v_mensagem;
    RETURN;
  END;
  RAISE EXCEPTION 'FALHA: nenhum erro, esperado %', p_estado;
END;
$$;
\o /dev/null
