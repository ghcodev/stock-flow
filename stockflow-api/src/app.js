require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const REQUIRED_ENV = ['JWT_SECRET', 'FRONTEND_URL'];
const hasDatabaseConfig = process.env.DATABASE_URL || process.env.DB_URL ||
  (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);

REQUIRED_ENV.forEach(key => {
  if (!process.env[key]) {
    console.error(`ERRO: variável de ambiente ${key} não definida`);
    process.exit(1);
  }
});

if (!hasDatabaseConfig) {
  console.error('ERRO: configuração de banco não definida. Use DATABASE_URL/DB_URL ou DB_HOST, DB_USER e DB_NAME.');
  process.exit(1);
}

const app = express();

app.use(helmet());
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: 'deny' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());

// Documentação
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'StockFlow API Docs',
  customCss: '.swagger-ui .topbar { background-color: #1F3864 }',
  swaggerOptions: { persistAuthorization: true },
}));

// Rotas
app.use('/api/v1/auth',           require('./routes/auth.routes'));
app.use('/api/v1/produtos',       require('./routes/produtos.routes'));
app.use('/api/v1/lotes',          require('./routes/lotes.routes'));
app.use('/api/v1/movimentacoes',  require('./routes/movimentacoes.routes'));
app.use('/api/v1/localizacoes',   require('./routes/localizacoes.routes'));
app.use('/api/v1/usuarios',       require('./routes/usuarios.routes'));
app.use('/api/v1/identificacoes', require('./routes/identificacoes.routes'));
app.use('/api/v1/auditoria',      require('./routes/auditoria.routes'));
app.use('/api/v1/dashboard',      require('./routes/dashboard.routes'));
app.use('/api/v1/inventarios',    require('./routes/inventarios.routes'));
app.use('/api/v1/inventario',     require('./routes/inventario.routes'));
app.use('/api/v1/sap',            require('./routes/sap.routes'));

// Health check
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: `Rota ${req.method} ${req.path} não encontrada` }));

// Error handler global
app.use((err, req, res, _next) => {
  console.error(`[${req.method} ${req.path}]`, err.message, err.stack?.split('\n')[1]);
  res.status(500).json({
    error: 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' ? { detalhe: err.message } : {}),
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StockFlow API rodando em http://localhost:${PORT}/api/v1`));

module.exports = app;
