import { AppError } from '../errors/index.js';
import { UniqueConstraintError, ForeignKeyConstraintError } from 'sequelize';

export const errorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    err = new AppError('Некорректный синтаксис JSON', 400, 'BAD_REQUEST');
  }

  if (err instanceof UniqueConstraintError) {
    const details = err.errors.map(e => ({ field: e.path, message: e.message }));
    err = new AppError('Конфликт уникальности данных', 409, 'CONFLICT', details);
  }

  if (err instanceof ForeignKeyConstraintError) {
    err = new AppError('Нарушение ссылочной целостности внешнего ключа', 409, 'FOREIGN_KEY_VIOLATION');
  }

  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  const response = {
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: statusCode === 500 && isProd ? 'Внутренняя ошибка сервера' : err.message,
      details: err.details || undefined,
      requestId: req.id
    }
  };

  if (statusCode >= 500) {
    req.log.error({ err, requestId: req.id }, 'Внутренняя ошибка');
  } else {
    req.log.warn({ err: err.message, requestId: req.id }, 'Клиентская ошибка');
  }

  res.status(statusCode).json(response);
};
