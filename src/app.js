import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import client from 'prom-client';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';

import { httpLogger } from './middlewares/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { metricsMiddleware } from './middlewares/metrics.middleware.js';
import { NotFoundError } from './errors/index.js';

import authRoutes from './routes/auth.routes.js';
import equipmentRoutes from './routes/equipment.routes.js';
import requestRoutes from './routes/request.routes.js';
import siteRoutes from './routes/site.routes.js';
import reportRoutes from './routes/report.routes.js';
import healthRoutes from './routes/health.routes.js';

const app = express();

app.set('trust proxy', 1);

app.use(metricsMiddleware);
app.use(httpLogger);
app.use(helmet());
app.use(cookieParser());

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('CORS Error'));
  },
  credentials: true
}));

app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Превышен лимит запросов' } }
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.static('public'));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

try {
  const openApiSpec = JSON.parse(fs.readFileSync(new URL('../docs/openapi.json', import.meta.url), 'utf-8'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
} catch (e) {
  // Обработка отсутствия файла до генерации документации
}

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/reports', reportRoutes);

app.use((req, res, next) => next(new NotFoundError('Маршрут не найден')));
app.use(errorHandler);

export default app;
