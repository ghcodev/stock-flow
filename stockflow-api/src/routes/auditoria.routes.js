const { Router } = require('express');
const ctrl = require('../controllers/auditoria.controller');
const { authMiddleware } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const router = Router();
router.use(authMiddleware, adminMiddleware);

router.get('/', ctrl.listar);
router.get('/lote/:id', ctrl.porLote);
router.get('/usuario/:id', ctrl.porUsuario);

module.exports = router;
