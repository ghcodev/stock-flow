const { Router } = require('express');
const ctrl = require('../controllers/auditoria.controller');
const { authMiddleware } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { checkPermission } = require('../middleware/permission');

const router = Router();
router.use(authMiddleware, adminMiddleware);

router.get('/', checkPermission('auditoria', 'ver'), ctrl.listar);
router.get('/lote/:id', checkPermission('auditoria', 'ver'), ctrl.porLote);
router.get('/usuario/:id', checkPermission('auditoria', 'ver'), ctrl.porUsuario);

module.exports = router;
