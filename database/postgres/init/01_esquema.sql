CREATE TYPE status_lote AS ENUM ('ativo','bloqueado','vencido');
CREATE TYPE tipo_movimentacao AS ENUM ('entrada','saida','transferencia','ajuste','inventario');
CREATE TYPE status_movimentacao AS ENUM ('pendente','concluida','cancelada');
CREATE TYPE perfil_usuario AS ENUM ('administrador','operador');
CREATE TYPE tipo_identificacao AS ENUM ('qr_code','rfid');
CREATE TYPE operacao_auditoria AS ENUM ('INSERT','UPDATE','DELETE','LOGIN','AJUSTE','BLOQUEIO');

CREATE TABLE produto (
  id_produto INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  categoria VARCHAR(60),
  descricao TEXT,
  unidade_medida VARCHAR(10) NOT NULL,
  estoque_minimo NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE localizacao (
  id_localizacao INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  corredor VARCHAR(10) NOT NULL,
  nivel VARCHAR(10) NOT NULL,
  posicao VARCHAR(10) NOT NULL,
  descricao VARCHAR(120),
  UNIQUE (corredor, nivel, posicao)
);

CREATE TABLE usuario (
  id_usuario INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  senha_hash CHAR(60) NOT NULL,
  perfil perfil_usuario NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lote (
  id_lote INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero_lote VARCHAR(50) NOT NULL UNIQUE,
  data_fabricacao DATE,
  data_validade DATE,
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  id_produto INTEGER NOT NULL REFERENCES produto (id_produto),
  id_localizacao INTEGER NOT NULL REFERENCES localizacao (id_localizacao),
  status_lote status_lote NOT NULL DEFAULT 'ativo',
  data_bloqueio TIMESTAMPTZ,
  motivo_bloqueio TEXT,
  CHECK (data_validade >= data_fabricacao)
);

CREATE TABLE identificacao (
  id_identificacao INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_identificacao tipo_identificacao NOT NULL,
  codigo VARCHAR(128) NOT NULL UNIQUE,
  id_lote INTEGER NOT NULL UNIQUE REFERENCES lote (id_lote)
);

CREATE TABLE movimentacao (
  id_movimentacao BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_movimentacao tipo_movimentacao NOT NULL,
  data_movimentacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  quantidade NUMERIC(12,3) NOT NULL CHECK (quantidade >= 0),
  saldo_anterior NUMERIC(12,3) NOT NULL,
  saldo_posterior NUMERIC(12,3) NOT NULL CHECK (saldo_posterior >= 0),
  id_lote INTEGER NOT NULL REFERENCES lote (id_lote),
  id_usuario INTEGER NOT NULL REFERENCES usuario (id_usuario) ON DELETE RESTRICT,
  id_localizacao_origem INTEGER REFERENCES localizacao (id_localizacao),
  id_localizacao_destino INTEGER REFERENCES localizacao (id_localizacao),
  motivo_movimentacao VARCHAR(255),
  observacao TEXT,
  status_movimentacao status_movimentacao NOT NULL DEFAULT 'concluida',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (tipo_movimentacao = 'inventario' OR quantidade > 0),
  CHECK (tipo_movimentacao <> 'transferencia' OR (id_localizacao_origem IS NOT NULL AND id_localizacao_destino IS NOT NULL AND id_localizacao_origem <> id_localizacao_destino))
);

CREATE TABLE auditoria_log (
  id_log BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabela_afetada VARCHAR(50) NOT NULL,
  operacao operacao_auditoria NOT NULL,
  valor_anterior JSONB,
  valor_novo JSONB,
  id_usuario INTEGER REFERENCES usuario (id_usuario),
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_usuario INET,
  observacao TEXT
);
CREATE INDEX idx_auditoria_anterior ON auditoria_log USING GIN (valor_anterior);
CREATE INDEX idx_auditoria_novo ON auditoria_log USING GIN (valor_novo);
