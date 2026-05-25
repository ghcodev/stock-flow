-- =============================================================
-- StockFlow - Script de configuração completa do banco de dados
-- =============================================================

CREATE DATABASE IF NOT EXISTS stockflow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE stockflow;

SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------
-- 1. localizacao
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS localizacao (
  id           INT            NOT NULL AUTO_INCREMENT,
  corredor     VARCHAR(10)    NOT NULL,
  nivel        INT            NOT NULL,
  posicao      INT            NOT NULL,
  descricao    VARCHAR(255)   NULL,
  criado_em    DATETIME       NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 2. produto
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produto (
  id               INT            NOT NULL AUTO_INCREMENT,
  nome             VARCHAR(255)   NOT NULL,
  categoria        VARCHAR(100)   NOT NULL,
  descricao        TEXT           NULL,
  unidade_medida   VARCHAR(20)    NOT NULL,
  estoque_minimo   DECIMAL(10,3)  NOT NULL DEFAULT 0,
  ativo            TINYINT(1)     NOT NULL DEFAULT 1,
  criado_em        DATETIME       NOT NULL DEFAULT NOW(),
  atualizado_em    DATETIME       NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 3. usuario
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario (
  id          INT          NOT NULL AUTO_INCREMENT,
  nome        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  senha_hash  VARCHAR(255) NOT NULL,
  perfil      ENUM('administrador','operador') NOT NULL DEFAULT 'operador',
  ativo       TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em   DATETIME     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 4. lote
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lote (
  id               INT            NOT NULL AUTO_INCREMENT,
  numero_lote      VARCHAR(100)   NOT NULL UNIQUE,
  data_fabricacao  DATETIME       NOT NULL DEFAULT NOW(),
  data_validade    DATETIME       NULL,
  quantidade       DECIMAL(10,3)  NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  id_produto       INT            NOT NULL,
  id_localizacao   INT            NOT NULL,
  status_lote      ENUM('ativo','vencido','bloqueado','quarentena','finalizado') NOT NULL DEFAULT 'ativo',
  data_bloqueio    DATETIME       NULL,
  motivo_bloqueio  TEXT           NULL,
  criado_em        DATETIME       NOT NULL DEFAULT NOW(),
  atualizado_em    DATETIME       NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (id),
  CONSTRAINT fk_lote_produto       FOREIGN KEY (id_produto)     REFERENCES produto     (id) ON UPDATE CASCADE,
  CONSTRAINT fk_lote_localizacao   FOREIGN KEY (id_localizacao) REFERENCES localizacao (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 5. movimentacao
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimentacao (
  id                     INT           NOT NULL AUTO_INCREMENT,
  tipo                   ENUM('entrada','saida','transferencia','ajuste','inventario') NOT NULL,
  data_movimentacao      DATETIME      NOT NULL DEFAULT NOW(),
  quantidade             DECIMAL(10,3) NOT NULL CHECK (quantidade > 0),
  id_lote                INT           NOT NULL,
  id_usuario             INT           NOT NULL,
  id_localizacao_origem  INT           NULL,
  id_localizacao_destino INT           NULL,
  motivo_movimentacao    VARCHAR(255)  NULL,
  observacao             TEXT          NULL,
  status                 ENUM('pendente','concluida','cancelada') NOT NULL DEFAULT 'pendente',
  criado_em              DATETIME      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT fk_mov_lote        FOREIGN KEY (id_lote)                REFERENCES lote        (id) ON UPDATE CASCADE,
  CONSTRAINT fk_mov_usuario     FOREIGN KEY (id_usuario)             REFERENCES usuario     (id) ON UPDATE CASCADE,
  CONSTRAINT fk_mov_loc_origem  FOREIGN KEY (id_localizacao_origem)  REFERENCES localizacao (id) ON UPDATE CASCADE,
  CONSTRAINT fk_mov_loc_destino FOREIGN KEY (id_localizacao_destino) REFERENCES localizacao (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 6. identificacao
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identificacao (
  id        INT          NOT NULL AUTO_INCREMENT,
  tipo      ENUM('QR Code','RFID') NOT NULL,
  codigo    VARCHAR(500) NOT NULL UNIQUE,
  id_lote   INT          NOT NULL UNIQUE,
  criado_em DATETIME     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT fk_identificacao_lote FOREIGN KEY (id_lote) REFERENCES lote (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 7. auditoria_log  (imutável: apenas INSERT permitido)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria_log (
  id               INT          NOT NULL AUTO_INCREMENT,
  tabela_afetada   VARCHAR(100) NOT NULL,
  operacao         ENUM('INSERT','UPDATE','DELETE','LOGIN','AJUSTE','BLOQUEIO') NOT NULL,
  valor_anterior   TEXT         NULL,
  valor_novo       TEXT         NULL,
  id_usuario       INT          NULL,
  data_hora        DATETIME     NOT NULL DEFAULT NOW(),
  ip_usuario       VARCHAR(45)  NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================
-- TRIGGERS DE AUDITORIA
-- =============================================================

DELIMITER $$

-- Trigger 1: auditoria após INSERT em movimentacao
DROP TRIGGER IF EXISTS trg_audit_movimentacao_insert$$
CREATE TRIGGER trg_audit_movimentacao_insert
AFTER INSERT ON movimentacao
FOR EACH ROW
BEGIN
  INSERT INTO auditoria_log (tabela_afetada, operacao, valor_novo, data_hora)
  VALUES (
    'movimentacao',
    'INSERT',
    CONCAT('tipo:', NEW.tipo, ',quantidade:', NEW.quantidade, ',id_lote:', NEW.id_lote, ',status:', NEW.status),
    NOW()
  );
END$$

-- Trigger 2: auditoria após UPDATE em lote (quantidade e/ou status)
DROP TRIGGER IF EXISTS trg_audit_lote_update$$
CREATE TRIGGER trg_audit_lote_update
AFTER UPDATE ON lote
FOR EACH ROW
BEGIN
  IF OLD.quantidade != NEW.quantidade OR OLD.status_lote != NEW.status_lote THEN
    INSERT INTO auditoria_log (tabela_afetada, operacao, valor_anterior, valor_novo, data_hora)
    VALUES (
      'lote',
      'UPDATE',
      CONCAT('quantidade:', OLD.quantidade, ',status_lote:', OLD.status_lote),
      CONCAT('quantidade:', NEW.quantidade, ',status_lote:', NEW.status_lote),
      NOW()
    );
  END IF;
END$$

-- Trigger 3: auditoria após INSERT em usuario
DROP TRIGGER IF EXISTS trg_audit_usuario_insert$$
CREATE TRIGGER trg_audit_usuario_insert
AFTER INSERT ON usuario
FOR EACH ROW
BEGIN
  INSERT INTO auditoria_log (tabela_afetada, operacao, valor_novo, data_hora)
  VALUES (
    'usuario',
    'INSERT',
    CONCAT('email:', NEW.email, ',perfil:', NEW.perfil),
    NOW()
  );
END$$

DELIMITER ;

-- =============================================================
-- SEED: dados iniciais
-- =============================================================

-- 4 localizações padrão
INSERT INTO localizacao (corredor, nivel, posicao, descricao) VALUES
  ('A', 1, 1, 'Corredor A - Nível 1 - Posição 1'),
  ('A', 1, 2, 'Corredor A - Nível 1 - Posição 2'),
  ('B', 2, 1, 'Corredor B - Nível 2 - Posição 1'),
  ('C', 1, 1, 'Corredor C - Nível 1 - Posição 1');

-- Usuário administrador (senha: Admin@1234)
INSERT INTO usuario (nome, email, senha_hash, perfil, ativo) VALUES
  ('Administrador', 'admin@stockflow.com', '$2b$12$CU2ggnSrYAxMd6z/WcmqYechRweErRaj41tmy0pqCbJeDPK1U.18y', 'administrador', 1);

-- =============================================================
-- VALIDAÇÃO FINAL
-- =============================================================

SHOW TABLES;
SHOW TRIGGERS;
SELECT id, nome, email, perfil, ativo FROM usuario;
