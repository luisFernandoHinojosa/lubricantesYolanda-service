import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import requestIp from 'request-ip';
import routes from './routes/index.js';
import passport from 'passport';
import './config/passport/index.js'
import config from './config/index.js';
import { errorHandler } from './middlewares/error.middleware.js';

const app = express();
const isProduction = config.server.nodeEnv === 'production';

// Detrás de Traefik (Dokploy): confiar en el primer proxy para obtener la IP real del cliente
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Health check (usado por Docker/Dokploy). Va antes del rate limit y de la autenticación.
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.use(passport.initialize());

// CORS: en producción solo los orígenes de CLIENT_URL (separados por coma)
const allowedOrigins = config.client.url
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin: isProduction
    ? (origin, callback) => {
      // Peticiones sin origin (curl, apps server-to-server) se permiten
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    }
    : true,
  credentials: true,
}));

app.use(helmet());
app.use(hpp());
app.use(requestIp.mw());

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limit general (holgado para el uso normal del POS)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { status: 'error', message: 'Demasiadas solicitudes, intenta más tarde' },
});

// Rate limit estricto para endpoints de autenticación (fuerza bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { status: 'error', message: 'Demasiados intentos, intenta en 15 minutos' },
});

app.use('/api/v1', generalLimiter);
app.use(
  ['/api/v1/auth/login', '/api/v1/auth/forgot-password', '/api/v1/auth/reset-password'],
  authLimiter,
);

app.use('/api/v1', routes);

app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: 'Resource not found',
  });
});

app.use(errorHandler);


export default app;
