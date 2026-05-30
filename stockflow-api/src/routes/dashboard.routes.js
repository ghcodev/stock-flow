const { Router } = require('express');
const ctrl = require('../controllers/dashboard.controller');
const { authMiddleware } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware);

router.get('/kpis', ctrl.kpis);
router.get('/movimentacoes', ctrl.movimentacoes);
router.get('/alertas', ctrl.alertas);
router.get('/alertas-pendentes', ctrl.alertasPendentes);
router.get('/ocupacao-corredores', ctrl.ocupacaoCorredores);
router.get('/top-produtos', ctrl.topProdutos);
router.get('/operadores-hoje', ctrl.operadoresHoje);
router.get('/saude-estoque', ctrl.saudeEstoque);

module.exports = router;
