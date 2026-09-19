import 'dotenv/config';
import app from './app.js';
import { logger } from './middlewares/logger.js';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Сервер запущен на порту ${PORT}`);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Необработанный отказ Promise');
  server.close(() => process.exit(1));
});
