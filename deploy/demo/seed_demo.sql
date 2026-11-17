\set ON_ERROR_STOP on

SELECT setseed(0.4242);

BEGIN;

ALTER TABLE movimentacao DISABLE TRIGGER trg_bloquear_saida;

SELECT set_config('app.user_id', '', true), set_config('app.ip', '', true);

INSERT INTO usuario (nome, email, senha_hash, perfil, created_at) VALUES
  ('Carlos Eduardo Matos', 'carlos.matos@stockflow.demo', '$2b$12$qaDUaiuxkEeSszc.jyVzfOiW4lfET4eBMLKzx9TAhoP9gNDr5VaiK', 'administrador', now() - interval '120 days'),
  ('Fernanda Lopes Ribeiro', 'fernanda.ribeiro@stockflow.demo', '$2b$12$qaDUaiuxkEeSszc.jyVzfOiW4lfET4eBMLKzx9TAhoP9gNDr5VaiK', 'administrador', now() - interval '120 days'),
  ('João Pedro Almeida', 'joao.almeida@stockflow.demo', '$2b$12$rWLjb0ce5klmUOnNJLmK2e0sA4Yb5ViY7hgmrpiARFnzcrGICzjGm', 'operador', now() - interval '110 days'),
  ('Beatriz Nogueira', 'beatriz.nogueira@stockflow.demo', '$2b$12$rWLjb0ce5klmUOnNJLmK2e0sA4Yb5ViY7hgmrpiARFnzcrGICzjGm', 'operador', now() - interval '110 days'),
  ('Rafael Souza Lima', 'rafael.lima@stockflow.demo', '$2b$12$rWLjb0ce5klmUOnNJLmK2e0sA4Yb5ViY7hgmrpiARFnzcrGICzjGm', 'operador', now() - interval '100 days'),
  ('Camila Teixeira', 'camila.teixeira@stockflow.demo', '$2b$12$rWLjb0ce5klmUOnNJLmK2e0sA4Yb5ViY7hgmrpiARFnzcrGICzjGm', 'operador', now() - interval '100 days');

INSERT INTO localizacao (corredor, nivel, posicao, capacidade, tipo_zona, distancia_expedicao, descricao)
SELECT c.corredor, n.nivel::text, lpad(p.posicao::text, 2, '0'),
       (2400 - n.nivel * 300)::numeric,
       c.zona::tipo_armazenagem,
       c.base + n.nivel * 2 + p.posicao,
       'Corredor ' || c.corredor || ', nível ' || n.nivel || ', posição ' || lpad(p.posicao::text, 2, '0')
FROM (VALUES ('A', 'seco', 4), ('B', 'refrigerado', 14), ('C', 'quimico', 24)) AS c(corredor, zona, base)
CROSS JOIN generate_series(1, 4) AS n(nivel)
CROSS JOIN generate_series(1, 10) AS p(posicao);

CREATE TEMP TABLE prod_def (nome text, categoria text, unidade text, zona text, peso numeric, minimo numeric, vida_util int, nlotes int);

INSERT INTO prod_def VALUES
  ('Farinha de trigo tipo 1', 'Matéria-prima', 'kg', 'seco', 1, 400, 180, 5),
  ('Farinha de trigo integral', 'Matéria-prima', 'kg', 'seco', 1, 250, 150, 3),
  ('Açúcar refinado', 'Matéria-prima', 'kg', 'seco', 1, 300, 365, 4),
  ('Açúcar cristal', 'Matéria-prima', 'kg', 'seco', 1, 200, 365, 3),
  ('Sal refinado', 'Matéria-prima', 'kg', 'seco', 1, 120, 720, 3),
  ('Fermento biológico seco', 'Matéria-prima', 'kg', 'seco', 0.5, 40, 240, 3),
  ('Chocolate em pó 50%', 'Matéria-prima', 'kg', 'seco', 1, 90, 300, 4),
  ('Cacau em pó alcalino', 'Matéria-prima', 'kg', 'seco', 1, 60, 360, 3),
  ('Amido de milho', 'Matéria-prima', 'kg', 'seco', 1, 80, 360, 3),
  ('Fubá mimoso', 'Matéria-prima', 'kg', 'seco', 1, 90, 240, 3),
  ('Arroz branco tipo 1', 'Mercearia', 'kg', 'seco', 5, 300, 360, 4),
  ('Feijão carioca', 'Mercearia', 'kg', 'seco', 1, 250, 300, 4),
  ('Óleo de soja', 'Mercearia', 'L', 'seco', 0.9, 150, 365, 4),
  ('Macarrão espaguete', 'Mercearia', 'kg', 'seco', 0.5, 180, 420, 4),
  ('Biscoito água e sal', 'Mercearia', 'cx', 'seco', 4.8, 120, 270, 4),
  ('Café torrado e moído', 'Mercearia', 'kg', 'seco', 0.5, 100, 270, 4),
  ('Achocolatado em pó', 'Mercearia', 'kg', 'seco', 0.4, 70, 300, 3),
  ('Leite em pó integral', 'Mercearia', 'kg', 'seco', 0.4, 70, 240, 3),
  ('Aveia em flocos', 'Mercearia', 'kg', 'seco', 0.5, 60, 300, 3),
  ('Granola tradicional', 'Mercearia', 'kg', 'seco', 0.5, 50, 210, 3),
  ('Suco de laranja integral', 'Bebidas', 'L', 'seco', 1, 120, 180, 4),
  ('Água mineral 500 ml', 'Bebidas', 'cx', 'seco', 12, 200, 540, 4),
  ('Caixa de papelão 40x30', 'Embalagens', 'un', 'seco', 0.4, 600, 3650, 3),
  ('Saco plástico 5 kg', 'Embalagens', 'un', 'seco', 0.02, 1500, 3650, 3),
  ('Filme stretch 500 mm', 'Embalagens', 'rolo', 'seco', 2, 80, 3650, 2),
  ('Fita adesiva transparente', 'Embalagens', 'un', 'seco', 0.2, 300, 3650, 2),
  ('Pote plástico 500 ml', 'Embalagens', 'un', 'seco', 0.03, 1200, 3650, 3),
  ('Etiqueta térmica 100x150', 'Embalagens', 'rolo', 'seco', 0.5, 150, 3650, 2),
  ('Leite integral UHT', 'Laticínios', 'L', 'refrigerado', 1.03, 300, 120, 5),
  ('Manteiga sem sal', 'Laticínios', 'kg', 'refrigerado', 0.5, 80, 90, 4),
  ('Queijo mussarela', 'Laticínios', 'kg', 'refrigerado', 3, 100, 60, 4),
  ('Iogurte natural', 'Laticínios', 'un', 'refrigerado', 0.17, 500, 40, 4),
  ('Creme de leite', 'Laticínios', 'L', 'refrigerado', 1, 90, 90, 3),
  ('Requeijão cremoso', 'Laticínios', 'kg', 'refrigerado', 0.25, 60, 70, 3),
  ('Presunto fatiado', 'Frios', 'kg', 'refrigerado', 0.5, 50, 45, 3),
  ('Margarina cremosa', 'Laticínios', 'kg', 'refrigerado', 0.5, 70, 120, 3),
  ('Massa folhada congelada', 'Congelados', 'kg', 'refrigerado', 1, 60, 180, 3),
  ('Pão de queijo congelado', 'Congelados', 'kg', 'refrigerado', 1, 120, 150, 3),
  ('Polpa de morango congelada', 'Congelados', 'kg', 'refrigerado', 1, 50, 240, 2),
  ('Detergente neutro', 'Limpeza', 'L', 'quimico', 1, 100, 720, 3),
  ('Desinfetante pinho', 'Limpeza', 'L', 'quimico', 1, 80, 720, 3),
  ('Hipoclorito de sódio 2%', 'Químicos', 'L', 'quimico', 1.1, 60, 180, 3),
  ('Álcool etílico 70%', 'Limpeza', 'L', 'quimico', 0.85, 90, 540, 3),
  ('Solvente industrial', 'Químicos', 'L', 'quimico', 0.85, 40, 720, 2),
  ('Sanitizante peracético', 'Químicos', 'L', 'quimico', 1.1, 40, 365, 2);

INSERT INTO produto (nome, categoria, descricao, unidade_medida, tipo_armazenagem, peso_unitario_kg, estoque_minimo, created_at)
SELECT nome, categoria, nome || ' (' || categoria || ')', unidade, zona::tipo_armazenagem, peso, minimo, now() - interval '130 days'
FROM prod_def ORDER BY nome;

CREATE TEMP TABLE lotdef (
  lk int PRIMARY KEY, numero text, id_produto int, unidade text, zona text, tipo text,
  e0 timestamptz, t_fim timestamptz, fab date, validade date, loc_ini int, qtd_ini numeric, pend boolean DEFAULT false,
  id_lote int, dec int
);

CREATE TEMP TABLE ev (
  seq serial PRIMARY KEY, ts timestamptz NOT NULL, lk int NOT NULL, tipo text NOT NULL,
  qtd numeric, ant numeric, pos numeric, uid int, motivo text, obs text,
  loc_o int, loc_d int, delta numeric
);

CREATE FUNCTION pg_temp.dia_util(d date) RETURNS date AS $$
  SELECT CASE extract(dow FROM d)::int WHEN 6 THEN d - 1 WHEN 0 THEN d - 2 ELSE d END
$$ LANGUAGE sql IMMUTABLE;

CREATE FUNCTION pg_temp.rnd() RETURNS numeric AS $$ SELECT random()::numeric $$ LANGUAGE sql VOLATILE;

CREATE FUNCTION pg_temp.hora_util(d date) RETURNS timestamptz AS $$
  SELECT (d::timestamp + make_interval(hours => 8 + floor(random() * 10)::int, mins => floor(random() * 60)::int, secs => floor(random() * 60)::int))::timestamptz
$$ LANGUAGE sql VOLATILE;

INSERT INTO lotdef (lk, numero, id_produto, unidade, zona, tipo, dec)
SELECT row_number() OVER (ORDER BY pr.nome, g.i), NULL, pr.id_produto, d.unidade, d.zona, 'normal',
       CASE WHEN d.unidade IN ('un', 'cx', 'rolo') THEN 0 ELSE 1 END
FROM prod_def d
JOIN produto pr ON pr.nome = d.nome
CROSS JOIN LATERAL generate_series(1, d.nlotes) AS g(i);

WITH sorteio AS (
  SELECT lk, row_number() OVER (ORDER BY random()) AS r FROM lotdef
)
UPDATE lotdef l SET tipo = CASE WHEN s.r <= 12 THEN 'vencendo' WHEN s.r <= 20 THEN 'venc' WHEN s.r <= 27 THEN 'bloq' ELSE 'normal' END
FROM sorteio s WHERE s.lk = l.lk;

WITH sorteio AS (
  SELECT lk, row_number() OVER (ORDER BY random()) AS r FROM lotdef WHERE tipo = 'normal'
)
UPDATE lotdef l SET pend = true FROM sorteio s WHERE s.lk = l.lk AND s.r <= 9;

UPDATE lotdef l SET
  e0 = pg_temp.hora_util(pg_temp.dia_util(current_date - (CASE l.tipo WHEN 'venc' THEN 45 + floor(random() * 43)::int WHEN 'bloq' THEN 22 + floor(random() * 66)::int ELSE 4 + floor(random() * 84)::int END))),
  validade = CASE l.tipo
    WHEN 'vencendo' THEN current_date + (2 + floor(random() * 26)::int)
    WHEN 'venc' THEN current_date - (3 + floor(random() * 26)::int)
    ELSE current_date + (45 + floor(random() * 380)::int) END;

UPDATE lotdef l SET
  fab = l.validade - (d.vida_util / 2 + floor(random() * 60)::int),
  numero = 'L' || to_char(l.validade - (d.vida_util / 2), 'YYMM') || '-' || lpad(l.lk::text, 4, '0'),
  qtd_ini = round((CASE WHEN l.unidade IN ('un', 'cx', 'rolo') THEN 150 + random() * 1850 ELSE 60 + random() * 640 END)::numeric, l.dec),
  loc_ini = (SELECT lo.id_localizacao FROM localizacao lo WHERE lo.tipo_zona = l.zona::tipo_armazenagem ORDER BY random() LIMIT 1)
FROM prod_def d JOIN produto pr ON pr.nome = d.nome WHERE pr.id_produto = l.id_produto;

UPDATE lotdef SET t_fim = CASE tipo
  WHEN 'venc' THEN (validade::timestamp + interval '23 hours')::timestamptz
  WHEN 'bloq' THEN pg_temp.hora_util(pg_temp.dia_util(current_date - (1 + floor(random() * 13)::int)))
  ELSE now() - interval '40 minutes' END;

UPDATE lotdef SET e0 = LEAST(e0, t_fim - interval '5 days') WHERE tipo IN ('venc', 'bloq');

DO $plano$
DECLARE
  r record;
  admins int[] := ARRAY(SELECT id_usuario FROM usuario WHERE perfil = 'administrador' ORDER BY id_usuario);
  ops int[] := ARRAY(SELECT id_usuario FROM usuario WHERE perfil = 'operador' ORDER BY id_usuario);
  bal numeric;
  n int;
  t timestamptz;
  ult timestamptz;
  x numeric;
  q numeric;
  sorteio numeric;
  loc_atual int;
  loc_novo int;
  delta numeric;
  contado numeric;
  motivos_saida text[] := ARRAY['Expedição pedido PV-', 'Consumo na produção OP-', 'Reposição de loja pedido RL-', 'Separação de carga CG-'];
  motivos_ajuste text[] := ARRAY['Quebra identificada na conferência física do endereço', 'Correção após recontagem do setor', 'Avaria por manuseio na expedição', 'Sobra encontrada no endereço durante a organização'];
  motivos_transf text[] := ARRAY['Reorganização do endereçamento', 'Otimização do picking', 'Liberação de posição para novo recebimento'];
  fornecedores text[] := ARRAY['Moinho Santa Clara', 'Distribuidora Vale Verde', 'Laticínios Serra Azul', 'Embalagens Brasil Sul', 'Químicos Atlântico', 'Cooperativa Campo Fértil'];
BEGIN
  FOR r IN SELECT * FROM lotdef ORDER BY lk LOOP
    bal := r.qtd_ini;
    loc_atual := r.loc_ini;
    INSERT INTO ev (ts, lk, tipo, uid, loc_d) VALUES (r.e0 - interval '10 minutes', r.lk, 'criar', ops[1 + floor(random() * array_length(ops, 1))::int], loc_atual);
    INSERT INTO ev (ts, lk, tipo, qtd, ant, pos, uid, motivo, obs, loc_d)
    VALUES (r.e0, r.lk, 'entrada', bal, 0, bal, ops[1 + floor(random() * array_length(ops, 1))::int],
            'Recebimento de ' || fornecedores[1 + floor(random() * array_length(fornecedores, 1))::int] || ' NF ' || (10000 + floor(random() * 89999)::int), NULL, loc_atual);
    ult := r.e0;
    n := 4 + floor(random() * 11)::int;
    FOR t IN
      SELECT pg_temp.hora_util(pg_temp.dia_util((r.e0 + (r.t_fim - r.e0 - interval '4 hours') * random())::date))
      FROM generate_series(1, n) ORDER BY 1
    LOOP
      CONTINUE WHEN t <= ult + interval '1 hour' OR t >= r.t_fim - interval '1 hour' OR t >= now() - interval '30 minutes';
      sorteio := random();
      IF sorteio < 0.66 THEN
        q := round(bal * (0.04 + pg_temp.rnd() * 0.16), r.dec);
        IF q > 0 AND q <= bal THEN
          INSERT INTO ev (ts, lk, tipo, qtd, ant, pos, uid, motivo, loc_o)
          VALUES (t, r.lk, 'saida', q, bal, bal - q, ops[1 + floor(random() * array_length(ops, 1))::int],
                  motivos_saida[1 + floor(random() * array_length(motivos_saida, 1))::int] || (1000 + floor(random() * 8999)::int), loc_atual);
          bal := bal - q;
          ult := t;
        END IF;
      ELSIF sorteio < 0.78 THEN
        q := round(r.qtd_ini * (0.15 + pg_temp.rnd() * 0.4), r.dec);
        INSERT INTO ev (ts, lk, tipo, qtd, ant, pos, uid, motivo, loc_d)
        VALUES (t, r.lk, 'entrada', q, bal, bal + q, ops[1 + floor(random() * array_length(ops, 1))::int],
                'Recebimento de ' || fornecedores[1 + floor(random() * array_length(fornecedores, 1))::int] || ' NF ' || (10000 + floor(random() * 89999)::int), loc_atual);
        bal := bal + q;
        ult := t;
      ELSIF sorteio < 0.86 THEN
        SELECT lo.id_localizacao INTO loc_novo FROM localizacao lo
        WHERE lo.tipo_zona = r.zona::tipo_armazenagem AND lo.id_localizacao <> loc_atual ORDER BY random() LIMIT 1;
        INSERT INTO ev (ts, lk, tipo, qtd, ant, pos, uid, motivo, loc_o, loc_d)
        VALUES (t, r.lk, 'transferencia', bal, bal, bal, ops[1 + floor(random() * array_length(ops, 1))::int],
                motivos_transf[1 + floor(random() * array_length(motivos_transf, 1))::int], loc_atual, loc_novo);
        loc_atual := loc_novo;
        ult := t;
      ELSIF sorteio < 0.91 THEN
        delta := round(bal * (0.01 + pg_temp.rnd() * 0.04) * (CASE WHEN pg_temp.rnd() < 0.7 THEN -1 ELSE 1 END), r.dec);
        IF delta <> 0 AND bal + delta > 0 THEN
          INSERT INTO ev (ts, lk, tipo, qtd, ant, pos, uid, motivo, loc_o)
          VALUES (t, r.lk, 'ajuste', abs(delta), bal, bal + delta, admins[1 + floor(random() * array_length(admins, 1))::int],
                  motivos_ajuste[1 + floor(random() * array_length(motivos_ajuste, 1))::int], loc_atual);
          bal := bal + delta;
          ult := t;
        END IF;
      ELSIF sorteio < 0.97 THEN
        delta := (CASE WHEN pg_temp.rnd() < 0.35 THEN 0 ELSE round(bal * (0.005 + pg_temp.rnd() * 0.03) * (CASE WHEN pg_temp.rnd() < 0.7 THEN -1 ELSE 1 END), r.dec) END);
        IF bal + delta >= 0 THEN
          INSERT INTO ev (ts, lk, tipo, qtd, ant, pos, uid, delta, obs)
          VALUES (t, r.lk, 'cont_ok', bal + delta, bal, bal + delta, ops[1 + floor(random() * array_length(ops, 1))::int], delta,
                  CASE WHEN delta = 0 THEN 'Contagem rotativa sem divergência' ELSE 'Divergência encontrada na contagem rotativa' END);
          bal := bal + delta;
          ult := t + interval '40 minutes';
        END IF;
      ELSE
        INSERT INTO ev (ts, lk, tipo, qtd, ant, pos, uid, obs)
        VALUES (t, r.lk, 'cont_cancel', round(bal * (0.9 + pg_temp.rnd() * 0.2), r.dec), bal, bal, ops[1 + floor(pg_temp.rnd() * array_length(ops, 1))::int], 'Contagem cancelada: endereço em reorganização');
        ult := t + interval '40 minutes';
      END IF;
    END LOOP;
    IF r.pend AND ult + interval '3 hours' < now() - interval '1 hour' THEN
      contado := round(bal * (0.94 + pg_temp.rnd() * 0.1), r.dec);
      INSERT INTO ev (ts, lk, tipo, qtd, ant, pos, uid, obs)
      VALUES (LEAST(ult + interval '3 hours' + (now() - ult - interval '5 hours') * random() * 0.5, now() - interval '1 hour'), r.lk, 'cont_pend', contado, bal, bal,
              ops[1 + floor(random() * array_length(ops, 1))::int], 'Aguardando finalização do administrador');
    END IF;
    IF r.tipo = 'venc' THEN
      INSERT INTO ev (ts, lk, tipo) VALUES ((r.validade + 1)::timestamp::timestamptz + interval '5 minutes', r.lk, 'venc');
    ELSIF r.tipo = 'bloq' THEN
      INSERT INTO ev (ts, lk, tipo, uid, motivo) VALUES (r.t_fim, r.lk, 'bloq', admins[1 + floor(random() * array_length(admins, 1))::int],
        (ARRAY['Embalagem avariada na conferência', 'Suspeita de contaminação cruzada', 'Temperatura fora da faixa no recebimento', 'Divergência de rótulo apontada pela qualidade', 'Aguardando laudo do fornecedor'])[1 + floor(random() * 5)::int]);
    END IF;
  END LOOP;
END
$plano$;

DO $execucao$
DECLARE
  e record;
  v_id_lote int;
  v_id_mov bigint;
  v_loc int;
  v_admin int := (SELECT id_usuario FROM usuario WHERE perfil = 'administrador' ORDER BY id_usuario LIMIT 1);
  v_num text;
  v_motivo text;
BEGIN
  FOR e IN SELECT * FROM ev ORDER BY ts, seq LOOP
    PERFORM set_config('app.user_id', COALESCE(e.uid::text, ''), true);
    PERFORM set_config('app.ip', CASE WHEN e.uid IS NULL THEN '' ELSE '10.20.0.' || (10 + e.uid) END, true);
    SELECT id_lote INTO v_id_lote FROM lotdef WHERE lk = e.lk;
    IF e.tipo = 'criar' THEN
      INSERT INTO lote (numero_lote, data_fabricacao, data_validade, quantidade, id_produto, id_localizacao, status_lote)
      SELECT numero, fab, validade, 0, id_produto, loc_ini, 'ativo' FROM lotdef WHERE lk = e.lk
      RETURNING id_lote, numero_lote INTO v_id_lote, v_num;
      UPDATE lotdef SET id_lote = v_id_lote WHERE lk = e.lk;
      INSERT INTO identificacao (tipo_identificacao, codigo, id_lote)
      VALUES (CASE WHEN e.lk % 3 = 0 THEN 'rfid' ELSE 'qr_code' END::tipo_identificacao,
              CASE WHEN e.lk % 3 = 0 THEN 'E200' || upper(substr(md5('rfid' || e.lk::text), 1, 20)) ELSE 'QR-' || v_num END,
              v_id_lote);
    ELSIF e.tipo IN ('entrada', 'saida', 'ajuste') THEN
      INSERT INTO movimentacao (tipo_movimentacao, data_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario,
                                id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, observacao, status_movimentacao, created_at)
      VALUES (e.tipo::tipo_movimentacao, e.ts, e.qtd, e.ant, e.pos, v_id_lote, e.uid, e.loc_o, e.loc_d, e.motivo, e.obs, 'concluida', e.ts);
      UPDATE lote SET quantidade = e.pos WHERE id_lote = v_id_lote;
    ELSIF e.tipo = 'transferencia' THEN
      INSERT INTO movimentacao (tipo_movimentacao, data_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario,
                                id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, status_movimentacao, created_at)
      VALUES ('transferencia', e.ts, e.qtd, e.ant, e.pos, v_id_lote, e.uid, e.loc_o, e.loc_d, e.motivo, 'concluida', e.ts);
      UPDATE lote SET id_localizacao = e.loc_d WHERE id_lote = v_id_lote;
    ELSIF e.tipo IN ('cont_ok', 'cont_cancel', 'cont_pend') THEN
      INSERT INTO movimentacao (tipo_movimentacao, data_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario,
                                motivo_movimentacao, observacao, status_movimentacao, created_at)
      VALUES ('inventario', e.ts, e.qtd, e.ant, e.pos, v_id_lote, e.uid, 'Contagem de inventário', e.obs, 'pendente', e.ts)
      RETURNING id_movimentacao INTO v_id_mov;
      IF e.tipo <> 'cont_pend' THEN
        PERFORM set_config('app.user_id', (SELECT id_usuario FROM usuario WHERE perfil = 'administrador' ORDER BY id_usuario OFFSET (e.seq % 2) LIMIT 1)::text, true);
        UPDATE movimentacao SET status_movimentacao = CASE WHEN e.tipo = 'cont_ok' THEN 'concluida' ELSE 'cancelada' END::status_movimentacao WHERE id_movimentacao = v_id_mov;
        IF e.tipo = 'cont_ok' AND e.delta <> 0 THEN
          INSERT INTO movimentacao (tipo_movimentacao, data_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario,
                                    motivo_movimentacao, status_movimentacao, created_at)
          VALUES ('ajuste', e.ts + interval '1 minute', abs(e.delta), e.ant, e.pos, v_id_lote,
                  current_setting('app.user_id')::int, 'Finalização da contagem de inventário ' || v_id_mov, 'concluida', e.ts + interval '1 minute');
          UPDATE lote SET quantidade = e.pos WHERE id_lote = v_id_lote;
        END IF;
      END IF;
      CONTINUE;
    ELSIF e.tipo = 'venc' THEN
      UPDATE lote SET status_lote = 'vencido' WHERE id_lote = v_id_lote;
    ELSIF e.tipo = 'bloq' THEN
      UPDATE lote SET status_lote = 'bloqueado', data_bloqueio = e.ts, motivo_bloqueio = e.motivo WHERE id_lote = v_id_lote;
    END IF;
  END LOOP;
END
$execucao$;

UPDATE produto SET estoque_minimo = ceil((SELECT COALESCE(sum(l.quantidade), 0) FROM lote l WHERE l.id_produto = produto.id_produto AND l.status_lote = 'ativo') * 1.35)
WHERE nome IN ('Farinha de trigo integral', 'Cacau em pó alcalino', 'Queijo mussarela', 'Pão de queijo congelado', 'Hipoclorito de sódio 2%', 'Caixa de papelão 40x30', 'Água mineral 500 ml');

ALTER TABLE movimentacao ENABLE TRIGGER trg_bloquear_saida;

COMMIT;

ANALYZE;
