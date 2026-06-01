require('dotenv').config();
require('express-async-errors');

const REQUIRED_ENV = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);

if (!process.env.DB_PASS && !process.env.DB_PASSWORD) {
  missing.push('DB_PASS');
}

if (missing.length > 0) {
  console.error('FATAL: Variaveis de ambiente obrigatorias ausentes:', missing);
  process.exit(1);
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET muito curto - minimo 32 caracteres');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { apiLimiter, loginLimiter } = require('./middlewares/rateLimiter');

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqueado: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(express.json());

app.use('/api/v1/auth/login', loginLimiter);
app.use('/api/v1/', apiLimiter);

// Documentacao
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
app.use((req, res) => res.status(404).json({ error: `Rota ${req.method} ${req.path} nao encontrada` }));

// Error handler global
app.use((err, req, res, _next) => {
  const isDev = process.env.NODE_ENV === 'development';
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Erro interno do servidor',
    ...(isDev && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`StockFlow API rodando em http://localhost:${PORT}/api/v1`));

module.exports = app;
module.exports.server = server;
