import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepo } from '../repositories/user.repo.js';
import { AppError, ConflictError } from '../errors/index.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET и JWT_REFRESH_SECRET должны быть заданы в переменных окружения');
}
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export const AuthService = {
  register: async ({ username, email, password }) => {
    const existing = await UserRepo.findByLoginOrEmail(username) || await UserRepo.findByLoginOrEmail(email);
    if (existing) {
      throw new ConflictError('Пользователь с таким логином или email уже зарегистрирован');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserRepo.create({
      username,
      email,
      passwordHash,
      role: 'viewer'
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };
  },

  login: async ({ identifier, password }) => {
    const user = await UserRepo.findByLoginOrEmail(identifier);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError('Неверный логин или пароль', 401, 'INVALID_CREDENTIALS');
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      technicianId: user.technicianId
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    };
  },

  refreshToken: async (token) => {
    if (!token) throw new AppError('Требуется refresh-токен', 401, 'UNAUTHORIZED');

    try {
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
      const user = await UserRepo.findById(decoded.id);
      if (!user) throw new AppError('Пользователь не найден', 401, 'UNAUTHORIZED');

      const payload = {
        id: user.id,
        username: user.username,
        role: user.role,
        technicianId: user.technicianId
      };

      const newAccessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
      return { accessToken: newAccessToken };
    } catch (err) {
      throw new AppError('Недействительный или истекший refresh-токен', 401, 'INVALID_TOKEN');
    }
  },

  getMe: async (userId) => {
    const user = await UserRepo.findById(userId);
    if (!user) throw new AppError('Пользователь не найден', 404, 'NOT_FOUND');
    return user;
  }
};
