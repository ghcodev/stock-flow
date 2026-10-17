TRUNCATE auditoria_log, movimentacao, identificacao, lote, localizacao, produto, usuario RESTART IDENTITY CASCADE;

INSERT INTO usuario (nome, email, senha_hash, perfil)
VALUES ('Administrador PoC', 'admin@stockflow.local', repeat('x', 60), 'administrador');

INSERT INTO produto (nome, unidade_medida, estoque_minimo)
VALUES ('Farinha de trigo', 'kg', 50);

INSERT INTO localizacao (corredor, nivel, posicao)
VALUES ('A', '1', '01'), ('B', '2', '03');

INSERT INTO lote (numero_lote, data_fabricacao, data_validade, quantidade, id_produto, id_localizacao)
VALUES
  ('L-001', '2026-09-01', '2027-03-01', 100, 1, 1),
  ('L-002', '2026-09-01', '2027-03-01', 70, 1, 1);
