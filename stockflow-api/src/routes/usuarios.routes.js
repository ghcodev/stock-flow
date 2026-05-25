const { Router } = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/usuarios.controller');
const { authMiddleware } = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const router = Router();
router.use(authMiddleware);

// /perfil não exige admin — deve vir antes de /:id
router.get('/perfil', ctrl.perfil);

router.use(adminMiddleware);

router.get('/', ctrl.listar);
router.get('/:id', ctrl.buscarPorId);

router.post('/',
  body('nome').notEmpty().withMessage('Nome obrigatório'),
  body('email').isEmail().withMessage('E-mail inválido'),
  body('senha').isLength({ min: 6 }).withMessage('Senha mínima de 6 caracteres'),
  body('perfil').optional().isIn(['administrador','operador']).withMessage('Perfil inválido'),
  ctrl.criar
);

router.put('/:id',
  body('nome').optional().notEmpty(),
  body('email').optional().isEmail(),
  body('perfil').optional().isIn(['administrador','operador']),
  ctrl.atualizar
);

router.patch('/:id/inativar', ctrl.inativar);

module.exports = router;
