import { AuthService } from '../services/auth.service.js';
import { catchAsync } from '../utils/catchAsync.js';

export const register = catchAsync(async (req, res) => {
  const result = await AuthService.register(req.body);
  res.status(201).json(result);
});

export const login = catchAsync(async (req, res) => {
  const { accessToken, refreshToken, user } = await AuthService.login(req.body);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({ accessToken, user });
});

export const refresh = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken;
  const result = await AuthService.refreshToken(token);
  res.json(result);
});

export const logout = catchAsync(async (req, res) => {
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ message: 'Сессия успешно завершена' });
});

export const getMe = catchAsync(async (req, res) => {
  const user = await AuthService.getMe(req.user.id);
  res.json(user);
});
