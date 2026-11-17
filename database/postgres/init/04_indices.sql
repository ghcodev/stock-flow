CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_log ON auditoria_log (id_usuario, id_log);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabela_log ON auditoria_log (tabela_afetada, id_log);
CREATE INDEX IF NOT EXISTS idx_movimentacao_data ON movimentacao (data_movimentacao);
ANALYZE auditoria_log;
ANALYZE movimentacao;
