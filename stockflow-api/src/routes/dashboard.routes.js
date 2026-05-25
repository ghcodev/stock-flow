const { Router } = require('express');
const ctrl = require('../controllers/dashboard.controller');
const { authMiddleware } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware);

router.get('/kpis', ctrl.kpis);
router.get('/movimentacoes', ctrl.movimentacoes);
router.get('/alertas', ctrl.alertas);

module.exports = router;
