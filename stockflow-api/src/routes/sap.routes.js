const { Router } = require('express');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');

const router = Router();
router.use(authMiddleware);
router.use(checkPermission('sap', 'importar'));

const CATEGORIAS = {
  PAES: 'Pães',
  SALG: 'Salgados',
  QUIT: 'Quitandas',
  MASS: 'Massas',
};

const UNIDADES = {
  UN: 'unidade',
  KG: 'kg',
  PCT: 'pacote',
};

function normalizePayload(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.produtos)) return body.produtos;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

async function importarProdutos(produtos) {
  let importados = 0;
  let atualizados = 0;
  let erros = 0;
  const detalhes = [];

  for (const [index, item] of produtos.entries()) {
    try {
      const nome = item.MAKTX?.trim();
      if (!nome) throw new Error('MAKTX obrigatório');

      const skuSap = item.MATNR?.trim() || null;
      const categoria = CATEGORIAS[item.MATKL?.trim()] || item.MATKL || 'Padrão';
      const unidade = UNIDADES[item.MEINS?.trim()] || item.MEINS || 'unidade';
      const estoqueMinimo = Number(item.MINBE || 0);

      const [existing] = await pool.execute(
        'SELECT id FROM produto WHERE nome = ? OR (sku_sap IS NOT NULL AND sku_sap = ?) LIMIT 1',
        [nome, skuSap]
      );

      if (existing.length) {
        await pool.execute(
          'UPDATE produto SET nome=?, categoria=?, unidade_medida=?, estoque_minimo=?, sku_sap=?, ativo=1 WHERE id=?',
          [nome, categoria, unidade, estoqueMinimo, skuSap, existing[0].id]
        );
        atualizados += 1;
        detalhes.push({ linha: index + 1, status: 'atualizado', nome, sku_sap: skuSap });
      } else {
        await pool.execute(
          'INSERT INTO produto (nome, categoria, unidade_medida, estoque_minimo, sku_sap, ativo) VALUES (?,?,?,?,?,1)',
          [nome, categoria, unidade, estoqueMinimo, skuSap]
        );
        importados += 1;
        detalhes.push({ linha: index + 1, status: 'importado', nome, sku_sap: skuSap });
      }
    } catch (err) {
      erros += 1;
      detalhes.push({ linha: index + 1, status: 'erro', erro: err.message });
    }
  }

  return { importados, atualizados, erros, detalhes };
}

router.post('/importar-produtos', async (req, res) => {
  const produtos = normalizePayload(req.body);
  if (!produtos.length) return res.status(400).json({ error: 'Nenhum produto SAP recebido' });
  return res.json(await importarProdutos(produtos));
});

router.post('/importar-json', async (req, res) => {
  const produtos = normalizePayload(req.body);
  if (!produtos.length) return res.status(400).json({ error: 'Arquivo JSON sem produtos válidos' });
  return res.json(await importarProdutos(produtos));
});

module.exports = router;
