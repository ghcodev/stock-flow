USE stockflow;

ALTER TABLE auditoria_log
  ADD COLUMN IF NOT EXISTS observacao TEXT NULL;

SET @audit_user_id = NULL;
SET @audit_ip = 'seed';
SET @audit_op = 'UPDATE';

UPDATE usuario
SET email = 'carlos.matos.legacy@artetrigo.com.br'
WHERE email = 'carlos.matos@artetrigo.com.br' AND id <> 1;

UPDATE usuario
SET nome = 'Carlos Eduardo Matos',
    email = 'carlos.matos@artetrigo.com.br',
    perfil = 'administrador',
    ativo = 1
WHERE id = 1;

INSERT INTO usuario (nome, email, senha_hash, perfil, ativo)
VALUES
  ('José Antônio Silva', 'jose.silva@artetrigo.com.br', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oZ3RXnCha', 'operador', TRUE),
  ('Fernanda Lima Souza', 'fernanda.lima@artetrigo.com.br', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oZ3RXnCha', 'operador', TRUE),
  ('Patrícia Oliveira', 'patricia.oliveira@artetrigo.com.br', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oZ3RXnCha', 'operador', TRUE),
  ('Marcos Henrique Costa', 'marcos.costa@artetrigo.com.br', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oZ3RXnCha', 'operador', TRUE)
ON DUPLICATE KEY UPDATE nome = VALUES(nome), perfil = VALUES(perfil), ativo = VALUES(ativo);

UPDATE movimentacao m
SET id_usuario = 1
WHERE NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = m.id_usuario);

UPDATE lote SET status_lote = 'ativo'
WHERE status_lote IS NULL;

INSERT INTO lote (numero_lote, data_fabricacao, data_validade, quantidade, id_produto, id_localizacao, status_lote)
SELECT 'AT-PAO-2026-ALERT1', DATE_SUB(NOW(), INTERVAL 25 DAY), DATE_ADD(NOW(), INTERVAL 5 DAY), 80, p.id, 1, 'ativo'
FROM produto p
WHERE p.nome LIKE 'P_o Franc_s Congelado'
  AND NOT EXISTS (SELECT 1 FROM lote WHERE numero_lote = 'AT-PAO-2026-ALERT1')
LIMIT 1;

INSERT INTO lote (numero_lote, data_fabricacao, data_validade, quantidade, id_produto, id_localizacao, status_lote)
SELECT 'AT-SAL-2026-ALERT1', DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_ADD(NOW(), INTERVAL 3 DAY), 45, p.id, 2, 'ativo'
FROM produto p
WHERE p.nome = 'Coxinha de Frango 50g'
  AND NOT EXISTS (SELECT 1 FROM lote WHERE numero_lote = 'AT-SAL-2026-ALERT1')
LIMIT 1;

INSERT INTO lote (numero_lote, data_fabricacao, data_validade, quantidade, id_produto, id_localizacao, status_lote)
SELECT 'AT-QUI-2026-ALERT1', DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 12 DAY), 60, p.id, 3, 'ativo'
FROM produto p
WHERE p.nome LIKE 'P_o de Mel Tradicional'
  AND NOT EXISTS (SELECT 1 FROM lote WHERE numero_lote = 'AT-QUI-2026-ALERT1')
LIMIT 1;

INSERT INTO lote (numero_lote, data_fabricacao, data_validade, quantidade, id_produto, id_localizacao, status_lote)
SELECT 'AT-MAS-2026-ALERT1', DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_ADD(NOW(), INTERVAL 20 DAY), 35, p.id, 4, 'ativo'
FROM produto p
WHERE p.nome = 'Massa para Pastel'
  AND NOT EXISTS (SELECT 1 FROM lote WHERE numero_lote = 'AT-MAS-2026-ALERT1')
LIMIT 1;

INSERT INTO identificacao (tipo, codigo, id_lote)
SELECT 'RFID', CONCAT('AT-RF-', LPAD(l.id, 3, '0')), l.id
FROM lote l
WHERE NOT EXISTS (SELECT 1 FROM identificacao i WHERE i.id_lote = l.id);

INSERT INTO movimentacao (tipo, quantidade, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, data_movimentacao, status)
SELECT 'transferencia', 100, l.id, 1, 1, 2, 'Remanejamento câmara fria CF-01 para CF-02 - otimização de espaço', DATE_SUB(NOW(), INTERVAL 10 DAY), 'concluida'
FROM lote l
WHERE l.numero_lote = 'AT-PAO-2026-001'
  AND NOT EXISTS (SELECT 1 FROM movimentacao WHERE tipo = 'transferencia' AND motivo_movimentacao = 'Remanejamento câmara fria CF-01 para CF-02 - otimização de espaço');

INSERT INTO movimentacao (tipo, quantidade, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, data_movimentacao, status)
SELECT 'transferencia', 80, l.id, 3, 3, 4, 'Transferência salgados ES-01 para ES-02 - reordenação por validade', DATE_SUB(NOW(), INTERVAL 7 DAY), 'concluida'
FROM lote l
WHERE l.numero_lote = 'AT-SAL-2026-001'
  AND NOT EXISTS (SELECT 1 FROM movimentacao WHERE tipo = 'transferencia' AND motivo_movimentacao = 'Transferência salgados ES-01 para ES-02 - reordenação por validade');

INSERT INTO movimentacao (tipo, quantidade, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, data_movimentacao, status)
SELECT 'transferencia', 60, l.id, 1, 2, 1, 'Retorno CF-02 para CF-01 - manutenção câmara', DATE_SUB(NOW(), INTERVAL 5 DAY), 'concluida'
FROM lote l
WHERE l.numero_lote = 'AT-QJO-2026-001'
  AND NOT EXISTS (SELECT 1 FROM movimentacao WHERE tipo = 'transferencia' AND motivo_movimentacao = 'Retorno CF-02 para CF-01 - manutenção câmara');

INSERT INTO movimentacao (tipo, quantidade, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, data_movimentacao, status)
SELECT 'transferencia', 40, l.id, 3, 4, 3, 'Reorganização quitandas ES-02 para ES-01', DATE_SUB(NOW(), INTERVAL 3 DAY), 'concluida'
FROM lote l
WHERE l.numero_lote = 'AT-QUI-2026-001'
  AND NOT EXISTS (SELECT 1 FROM movimentacao WHERE tipo = 'transferencia' AND motivo_movimentacao = 'Reorganização quitandas ES-02 para ES-01');

INSERT INTO movimentacao (tipo, quantidade, id_lote, id_usuario, id_localizacao_origem, id_localizacao_destino, motivo_movimentacao, data_movimentacao, status)
SELECT 'transferencia', 50, l.id, 1, 1, 4, 'Transferência para área de separação de pedidos', DATE_SUB(NOW(), INTERVAL 1 DAY), 'concluida'
FROM lote l
WHERE l.numero_lote = 'AT-PAO-2026-002'
  AND NOT EXISTS (SELECT 1 FROM movimentacao WHERE tipo = 'transferencia' AND motivo_movimentacao = 'Transferência para área de separação de pedidos');

DROP TRIGGER IF EXISTS trg_audit_movimentacao;
DROP TRIGGER IF EXISTS trg_audit_movimentacao_insert;
DROP TRIGGER IF EXISTS trg_audit_lote_update;

DELIMITER $$
CREATE TRIGGER trg_audit_movimentacao_insert
AFTER INSERT ON movimentacao
FOR EACH ROW
BEGIN
  INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario)
  VALUES (
    'movimentacao',
    'INSERT',
    NULL,
    JSON_OBJECT('descricao', COALESCE(NEW.observacao, NEW.motivo_movimentacao, NEW.tipo), 'quantidade', NEW.quantidade, 'id_lote', NEW.id_lote),
    NEW.id_usuario,
    NOW(),
    COALESCE(NULLIF(@audit_ip, ''), 'interno')
  );
END$$

CREATE TRIGGER trg_audit_lote_update
AFTER UPDATE ON lote
FOR EACH ROW
BEGIN
  IF OLD.quantidade <> NEW.quantidade THEN
    INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario)
    VALUES (
      'lote',
      IF(@audit_op = 'AJUSTE', 'AJUSTE', 'UPDATE'),
      JSON_OBJECT('campo', 'quantidade', 'valor', OLD.quantidade, 'lote', OLD.numero_lote),
      JSON_OBJECT('campo', 'quantidade', 'valor', NEW.quantidade, 'lote', NEW.numero_lote),
      @audit_user_id,
      NOW(),
      COALESCE(NULLIF(@audit_ip, ''), 'interno')
    );
  END IF;
END$$
DELIMITER ;

INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario, observacao)
SELECT 'movimentacao','INSERT', NULL, '{"tipo":"entrada","quantidade":480,"lote":"AT-PAO-2026-001"}', 1, DATE_SUB(NOW(), INTERVAL 15 DAY), '192.168.1.10', 'Entrada de produção - Pão Francês Congelado'
WHERE NOT EXISTS (SELECT 1 FROM auditoria_log WHERE observacao = 'Entrada de produção - Pão Francês Congelado');

INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario, observacao)
SELECT 'movimentacao','INSERT', NULL, '{"tipo":"transferencia","quantidade":100,"lote":"AT-PAO-2026-001"}', 1, DATE_SUB(NOW(), INTERVAL 10 DAY), '192.168.1.10', 'Transferência CF-01 para CF-02'
WHERE NOT EXISTS (SELECT 1 FROM auditoria_log WHERE observacao = 'Transferência CF-01 para CF-02');

INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario, observacao)
SELECT 'lote','UPDATE', '{"quantidade":480}', '{"quantidade":360}', 4, DATE_SUB(NOW(), INTERVAL 10 DAY), '192.168.1.14', 'Saída para distribuição Goiânia Centro'
WHERE NOT EXISTS (SELECT 1 FROM auditoria_log WHERE observacao = 'Saída para distribuição Goiânia Centro');

INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario, observacao)
SELECT 'usuario','INSERT', NULL, '{"email":"fernanda.lima@artetrigo.com.br","perfil":"operador"}', 1, DATE_SUB(NOW(), INTERVAL 20 DAY), '192.168.1.5', 'Cadastro novo operador'
WHERE NOT EXISTS (SELECT 1 FROM auditoria_log WHERE observacao = 'Cadastro novo operador');

INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario, observacao)
SELECT 'lote','BLOQUEIO', '{"status":"ativo"}', '{"status":"bloqueado"}', 1, DATE_SUB(NOW(), INTERVAL 8 DAY), '192.168.1.5', 'Lote bloqueado - suspeita de contaminação'
WHERE NOT EXISTS (SELECT 1 FROM auditoria_log WHERE observacao = 'Lote bloqueado - suspeita de contaminação');

INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario, observacao)
SELECT 'movimentacao','INSERT', NULL, '{"tipo":"ajuste","quantidade":10,"lote":"AT-QUI-2026-001"}', 1, DATE_SUB(NOW(), INTERVAL 5 DAY), '192.168.1.5', 'Ajuste após inventário rotativo CF-02'
WHERE NOT EXISTS (SELECT 1 FROM auditoria_log WHERE observacao = 'Ajuste após inventário rotativo CF-02');

INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario, observacao)
SELECT 'usuario','LOGIN', NULL, '{"email":"carlos.matos@artetrigo.com.br","sucesso":true}', 1, DATE_SUB(NOW(), INTERVAL 1 DAY), '192.168.1.5', NULL
WHERE NOT EXISTS (SELECT 1 FROM auditoria_log WHERE valor_novo = '{"email":"carlos.matos@artetrigo.com.br","sucesso":true}');

INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario, observacao)
SELECT 'movimentacao','INSERT', NULL, '{"tipo":"saida","quantidade":90,"lote":"AT-SAL-2026-001"}', 4, DATE_SUB(NOW(), INTERVAL 3 DAY), '192.168.1.14', 'Venda direta supermercado'
WHERE NOT EXISTS (SELECT 1 FROM auditoria_log WHERE observacao = 'Venda direta supermercado');

INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario, observacao)
SELECT 'lote','UPDATE', '{"quantidade":290}', '{"quantidade":200}', 4, DATE_SUB(NOW(), INTERVAL 3 DAY), '192.168.1.14', NULL
WHERE NOT EXISTS (SELECT 1 FROM auditoria_log WHERE valor_anterior = '{"quantidade":290}' AND valor_novo = '{"quantidade":200}');

INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, id_usuario, data_hora, ip_usuario, observacao)
SELECT 'usuario','UPDATE', '{"perfil":"operador"}', '{"perfil":"administrador"}', 1, DATE_SUB(NOW(), INTERVAL 25 DAY), '192.168.1.5', 'Promoção de perfil autorizada'
WHERE NOT EXISTS (SELECT 1 FROM auditoria_log WHERE observacao = 'Promoção de perfil autorizada');
