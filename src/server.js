import 'dotenv/config';
import app from './app.js';
import sequelize from './config/db.js';
import { logger } from './middlewares/logger.js';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Успешное подключение к PostgreSQL через Sequelize');

    const server = app.listen(PORT, () => {
      logger.info(`Сервер запущен на порту ${PORT}`);
    });

    const shutdown = async () => {
      logger.info('Завершение работы сервиса...');
      server.close(async () => {
        await sequelize.close();
        logger.info('Пул соединений с БД закрыт');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.fatal({ err: error }, 'Не удалось подключиться к базе данных');
    process.exit(1);
  }
}

start();
