-- Seed demonstrativo para ocupacao visual do Mapa do Armazem.
-- Usa apenas lotes e localizacoes ja existentes no banco.

-- CF01-A: 8/24 posicoes ocupadas (33%)
UPDATE lote SET id_localizacao = 1 WHERE id = 1 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 2 WHERE id = 2 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 3 WHERE id = 3 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 4 WHERE id = 4 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 5 WHERE id = 5 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 6 WHERE id = 6 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 7 WHERE id = 7 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 8 WHERE id = 8 AND status_lote = 'ativo';

-- CF02-A: 13/24 posicoes ocupadas (54%)
UPDATE lote SET id_localizacao = 97 WHERE id = 9 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 98 WHERE id = 10 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 99 WHERE id = 11 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 100 WHERE id = 12 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 101 WHERE id = 13 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 102 WHERE id = 14 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 103 WHERE id = 15 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 104 WHERE id = 16 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 105 WHERE id = 17 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 106 WHERE id = 18 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 107 WHERE id = 19 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 108 WHERE id = 20 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 109 WHERE id = 21 AND status_lote = 'ativo';

-- CF03-A: 6/24 posicoes ocupadas (25%)
UPDATE lote SET id_localizacao = 193 WHERE id = 22 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 194 WHERE id = 23 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 195 WHERE id = 24 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 196 WHERE id = 25 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 197 WHERE id = 26 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 198 WHERE id = 27 AND status_lote = 'ativo';

-- ES01-A: 11/24 posicoes ocupadas (46%)
UPDATE lote SET id_localizacao = 385 WHERE id = 28 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 386 WHERE id = 29 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 387 WHERE id = 30 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 388 WHERE id = 31 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 389 WHERE id = 32 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 390 WHERE id = 33 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 391 WHERE id = 34 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 392 WHERE id = 35 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 393 WHERE id = 36 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 394 WHERE id = 37 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 395 WHERE id = 38 AND status_lote = 'ativo';

-- ES02-A: 4/24 posicoes ocupadas (17%)
UPDATE lote SET id_localizacao = 481 WHERE id = 40 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 482 WHERE id = 41 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 483 WHERE id = 42 AND status_lote = 'ativo';
UPDATE lote SET id_localizacao = 484 WHERE id = 43 AND status_lote = 'ativo';
