import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Изоляция: репозитории подменены заглушками, БД и внешние сервисы не нужны,
// повторный запуск даёт тот же результат.
const UserRepo = { findByLoginOrEmail: jest.fn(), findById: jest.fn(), create: jest.fn() };
const EquipmentRepo = {
  findAll: jest.fn(), findById: jest.fn(), findBySerial: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn()
};

jest.unstable_mockModule('../src/repositories/user.repo.js', () => ({ UserRepo }));
jest.unstable_mockModule('../src/repositories/equipment.repo.js', () => ({ EquipmentRepo }));

const { default: app } = await import('../src/app.js');
const { default: sequelize } = await import('../src/config/db.js');

const token = (role, extra = {}) =>
  jwt.sign({ id: 'u1', username: role, role, ...extra }, process.env.JWT_SECRET, { expiresIn: '15m' });
const bearer = (role, extra) => ({ Authorization: `Bearer ${token(role, extra)}` });

const UUID = '3f2b8c1e-5d4a-4c1b-9a7e-1b2c3d4e5f60';
const newEquipment = {
  name: 'Турбина ВЭУ-9', type: 'turbine', serialNumber: 'TRB-999',
  location: { lat: 55.7, lon: 37.6 }, status: 'operational'
};

beforeEach(() => jest.clearAllMocks());

describe('Эксплуатационные эндпоинты', () => {
  it('GET /api/health/live: 200', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/health/ready: 200, если БД доступна', async () => {
    jest.spyOn(sequelize, 'authenticate').mockResolvedValueOnce();
    const res = await request(app).get('/api/health/ready');
    expect(res.statusCode).toBe(200);
    expect(res.body.db).toBe('connected');
  });

  it('GET /api/health/ready: 503, если БД недоступна', async () => {
    jest.spyOn(sequelize, 'authenticate').mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).get('/api/health/ready');
    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('not_ready');
  });

  it('GET /metrics: метрики в формате Prometheus', async () => {
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('maintenance_api_http_requests_total');
  });

  it('неизвестный маршрут: 404 в едином формате ошибки', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Аутентификация', () => {
  const user = {
    id: 'u1', username: 'admin', email: 'admin@x.local', role: 'admin', technicianId: null,
    passwordHash: bcrypt.hashSync('Password123!', 4)
  };

  it('вход с верным паролем: токен, refresh-cookie с флагами, без хеша в ответе', async () => {
    UserRepo.findByLoginOrEmail.mockResolvedValue(user);
    const res = await request(app).post('/api/auth/login').send({ identifier: 'admin', password: 'Password123!' });
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash/);
    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/refreshToken=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('несуществующий пользователь и неверный пароль дают одинаковый 401', async () => {
    UserRepo.findByLoginOrEmail.mockResolvedValueOnce(null);
    const a = await request(app).post('/api/auth/login').send({ identifier: 'ghost', password: 'x12345' });
    UserRepo.findByLoginOrEmail.mockResolvedValueOnce(user);
    const b = await request(app).post('/api/auth/login').send({ identifier: 'admin', password: 'wrong-password' });
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
    expect(a.body.error.code).toBe(b.body.error.code);
  });

  it('регистрация создаёт viewer и не возвращает хеш', async () => {
    UserRepo.findByLoginOrEmail.mockResolvedValue(null);
    UserRepo.create.mockImplementation(async (d) => ({ id: 'n1', createdAt: new Date(), ...d }));
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'newbie', email: 'n@x.local', password: 'secret123' });
    expect(res.statusCode).toBe(201);
    expect(res.body.role).toBe('viewer');
    expect(JSON.stringify(res.body)).not.toMatch(/hash/i);
  });

  it('регистрация с полем role отклоняется (422)', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'hack', email: 'h@x.local', password: 'secret123', role: 'admin' });
    expect(res.statusCode).toBe(422);
  });

  it('регистрация занятого логина: 409', async () => {
    UserRepo.findByLoginOrEmail.mockResolvedValue(user);
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'admin', email: 'a@x.local', password: 'secret123' });
    expect(res.statusCode).toBe(409);
  });

  it('GET /api/auth/me с токеном: 200', async () => {
    UserRepo.findById.mockResolvedValue({ id: 'u1', username: 'admin', role: 'admin' });
    const res = await request(app).get('/api/auth/me').set(bearer('admin'));
    expect(res.statusCode).toBe(200);
    expect(res.body.username).toBe('admin');
  });

  it('refresh без cookie: 401', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.statusCode).toBe(401);
  });

  it('refresh с валидной cookie выдаёт новый access-токен', async () => {
    UserRepo.findById.mockResolvedValue({ id: 'u1', username: 'admin', role: 'admin', technicianId: null });
    const refresh = jwt.sign({ id: 'u1' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    const res = await request(app).post('/api/auth/refresh').set('Cookie', `refreshToken=${refresh}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('logout удаляет refresh-cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie'].join(';')).toMatch(/refreshToken=;/);
  });
});

describe('Доступ: 401 и 403', () => {
  it('без токена: 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/equipment');
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('с битым токеном: 401 INVALID_TOKEN', async () => {
    const res = await request(app).get('/api/equipment').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('viewer не может создавать оборудование: 403', async () => {
    const res = await request(app).post('/api/equipment').set(bearer('viewer')).send(newEquipment);
    expect(res.statusCode).toBe(403);
  });

  it('viewer не может создавать заявки: 403', async () => {
    const res = await request(app).post('/api/requests').set(bearer('viewer'))
      .send({ equipmentId: UUID, title: 'Проверка узла', description: 'x', priority: 'low' });
    expect(res.statusCode).toBe(403);
  });

  it('technician не может назначать бригаду и удалять заявки: 403', async () => {
    const a = await request(app).post(`/api/requests/${UUID}/assignees`).set(bearer('technician'))
      .send({ assignees: [{ technicianId: UUID, role: 'lead' }] });
    const d = await request(app).delete(`/api/requests/${UUID}`).set(bearer('technician'));
    expect(a.statusCode).toBe(403);
    expect(d.statusCode).toBe(403);
  });

  it('viewer читает список оборудования: 200', async () => {
    EquipmentRepo.findAll.mockResolvedValue({ total: 0, data: [] });
    const res = await request(app).get('/api/equipment').set(bearer('viewer'));
    expect(res.statusCode).toBe(200);
    expect(res.body.meta.total).toBe(0);
  });
});

describe('CRUD оборудования, валидация и конфликты', () => {
  it('admin создаёт оборудование: 201 и Location', async () => {
    EquipmentRepo.findBySerial.mockResolvedValue(null);
    EquipmentRepo.create.mockResolvedValue({ id: UUID, ...newEquipment });
    const res = await request(app).post('/api/equipment').set(bearer('admin')).send(newEquipment);
    expect(res.statusCode).toBe(201);
    expect(res.headers.location).toBe(`/api/equipment/${UUID}`);
  });

  it('повторный серийный номер: 409', async () => {
    EquipmentRepo.findBySerial.mockResolvedValue({ id: 'other' });
    const res = await request(app).post('/api/equipment').set(bearer('admin')).send(newEquipment);
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('некорректное тело: 422 со списком ошибок', async () => {
    const res = await request(app).post('/api/equipment').set(bearer('admin')).send({ name: 'x' });
    expect(res.statusCode).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('несуществующее оборудование: 404', async () => {
    EquipmentRepo.findById.mockResolvedValue(null);
    const res = await request(app).get(`/api/equipment/${UUID}`).set(bearer('viewer'));
    expect(res.statusCode).toBe(404);
  });
});
