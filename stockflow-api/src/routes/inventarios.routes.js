const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  return res.json({ data: [], total: 0 });
});

router.post('/', (req, res) => {
  return res.status(201).json({ mensagem: 'Inventário iniciado', id: null });
});

module.exports = router;
