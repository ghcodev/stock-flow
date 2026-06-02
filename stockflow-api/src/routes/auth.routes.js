const { Router } = require('express');
const { body } = require('express-validator');
const { login, logout, alterarSenha, usuarioPorCodigo } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middlewares/validate');

const router = Router();

router.get('/usuario-por-codigo/:codigo', usuarioPorCodigo);

router.post('/login',
  body().custom(value => {
    const codigo = value.codigo ?? value.id;
    if (!codigo || !/^\d+$/.test(String(codigo))) {
      throw new Error('Codigo do operador obrigatorio');
    }
    return true;
  }),
  body('senha').isLength({ min: 6 }).trim().withMessage('Senha deve ter no mínimo 6 caracteres'),
  validate,
  login
);

router.get('/perfil', authMiddleware, (req, res) => res.json({ usuario: req.user }));

router.post('/logout', authMiddleware, logout);

router.patch('/senha',
  authMiddleware,
  body('senha_atual').notEmpty().withMessage('Senha atual obrigatória'),
  body('nova_senha').isLength({ min: 6 }).withMessage('Nova senha deve ter no mínimo 6 caracteres'),
  validate,
  alterarSenha
);

module.exports = router;
