import jwt from 'jsonwebtoken';
import { AppError } from '../errors/index.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET не задан в переменных окружения');

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Требуется аутентификация', 401, 'UNAUTHORIZED'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Срок действия токена доступа истек', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Недействительный токен доступа', 401, 'INVALID_TOKEN'));
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('Недостаточно прав для выполнения операции', 403, 'FORBIDDEN'));
    }
    next();
  };
};
