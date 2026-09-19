import { AppError } from '../errors/index.js';

export const errorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    err = new AppError('Некорректный синтаксис JSON', 400, 'BAD_REQUEST');
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
