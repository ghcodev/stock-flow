\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES
  ('Administrador Dev', 'admin@stockflow.dev', '$2b$12$9IgfkehnEr5gWUfuPMheueKRXRDDm84JOzoqHm5HwhcT/7eQCdKj.', 'administrador'),
  ('Operador Dev', 'operador@stockflow.dev', '$2b$12$wtAWNmV5QTenmRbLx.9bM.zohAYx3C4h/SwUeLVzemhwnCZwE6LRC', 'operador')
ON CONFLICT (email) DO NOTHING;

INSERT INTO localizacao (corredor, nivel, posicao, capacidade, tipo_zona, distancia_expedicao, descricao) VALUES
  ('A', '1', '01', 2000, 'seco', 5, 'Corredor A, térreo, posição 01'),
  ('A', '1', '02', 2000, 'seco', 6, 'Corredor A, térreo, posição 02'),
  ('A', '2', '01', 1000, 'seco', 8, 'Corredor A, nível 2, posição 01'),
  ('B', '1', '01', 1500, 'refrigerado', 12, 'Câmara fria, posição 01'),
  ('B', '1', '02', 1500, 'refrigerado', 13, 'Câmara fria, posição 02'),
  ('C', '1', '01', 800, 'quimico', 20, 'Área de químicos, posição 01')
ON CONFLICT (corredor, nivel, posicao) DO NOTHING;

INSERT INTO produto (nome, categoria, descricao, unidade_medida, tipo_armazenagem, peso_unitario_kg, estoque_minimo)
SELECT v.nome, v.categoria, v.descricao, v.unidade_medida, v.tipo_armazenagem::tipo_armazenagem, v.peso_unitario_kg, v.estoque_minimo
FROM (VALUES
  ('Farinha de trigo', 'Matéria-prima', 'Farinha de trigo tipo 1', 'kg', 'seco', 1.000, 200),
  ('Açúcar refinado', 'Matéria-prima', 'Açúcar refinado em sacos', 'kg', 'seco', 1.000, 150),
  ('Leite integral', 'Laticínios', 'Leite integral UHT em caixas', 'L', 'refrigerado', 1.030, 100),
  ('Manteiga', 'Laticínios', 'Manteiga sem sal em tabletes', 'kg', 'refrigerado', 0.500, 40),
  ('Solvente industrial', 'Químicos', 'Solvente para limpeza de equipamentos', 'L', 'quimico', 0.850, 30)
) AS v(nome, categoria, descricao, unidade_medida, tipo_armazenagem, peso_unitario_kg, estoque_minimo)
WHERE NOT EXISTS (SELECT 1 FROM produto p WHERE p.nome = v.nome);

INSERT INTO lote (numero_lote, data_fabricacao, data_validade, quantidade, id_produto, id_localizacao, status_lote, data_bloqueio, motivo_bloqueio)
SELECT v.numero_lote, current_date - v.fab_dias, current_date + v.val_dias, v.quantidade, p.id_produto, l.id_localizacao,
       v.status::status_lote, CASE WHEN v.status = 'bloqueado' THEN now() END, v.motivo
FROM (VALUES
  ('DEV-0001', 'Farinha de trigo', 'A', '1', '01', 60, 300, 500, 'ativo', NULL),
  ('DEV-0002', 'Farinha de trigo', 'A', '1', '02', 30, 330, 80, 'ativo', NULL),
  ('DEV-0003', 'Açúcar refinado', 'A', '2', '01', 90, 270, 400, 'ativo', NULL),
  ('DEV-0004', 'Leite integral', 'B', '1', '01', 40, 12, 120, 'ativo', NULL),
  ('DEV-0005', 'Manteiga', 'B', '1', '02', 20, 25, 25, 'ativo', NULL),
  ('DEV-0006', 'Leite integral', 'B', '1', '01', 120, -10, 60, 'vencido', NULL),
  ('DEV-0007', 'Solvente industrial', 'C', '1', '01', 50, 200, 90, 'bloqueado', 'Embalagem avariada na conferência')
) AS v(numero_lote, produto, corredor, nivel, posicao, fab_dias, val_dias, quantidade, status, motivo)
JOIN produto p ON p.nome = v.produto
JOIN localizacao l ON l.corredor = v.corredor AND l.nivel = v.nivel AND l.posicao = v.posicao
ON CONFLICT (numero_lote) DO NOTHING;

INSERT INTO movimentacao (tipo_movimentacao, quantidade, saldo_anterior, saldo_posterior, id_lote, id_usuario, id_localizacao_destino, motivo_movimentacao)
SELECT 'entrada', l.quantidade, 0, l.quantidade, l.id_lote, u.id_usuario, l.id_localizacao, 'Carga inicial de desenvolvimento'
FROM lote l
CROSS JOIN usuario u
WHERE u.email = 'admin@stockflow.dev'
  AND l.numero_lote LIKE 'DEV-%'
  AND l.quantidade > 0
  AND NOT EXISTS (SELECT 1 FROM movimentacao m WHERE m.id_lote = l.id_lote);

COMMIT;
