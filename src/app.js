import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { httpLogger } from './middlewares/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { NotFoundError } from './errors/index.js';

const app = express();

app.use(httpLogger);
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',');
app.use(cors({ origin: (origin, cb) => {
  if (!origin || allowedOrigins.includes(origin)) cb(null, true);
  else cb(new Error('CORS Error'));
}}));

app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Превышен лимит запросов' } }
}));

app.use(express.json({ limit: '100kb' }));

import equipmentRoutes from "./routes/equipment.routes.js";
app.use("/api/equipment", equipmentRoutes);

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use((req, res, next) => next(new NotFoundError('Маршрут не найден')));
app.use(errorHandler);

export default app;
