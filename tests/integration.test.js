import request from 'supertest';
import app from '../src/app.js';

describe('Интеграционные тесты API и проверки безопасности', () => {
  it('GET /api/health/live возвращает 200 и uptime', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /metrics отдает метрики в формате Prometheus', async () => {
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('maintenance_api_');
  });

  it('Запрос к закрытому ресурсу без токена возвращает 401 Unauthorized', async () => {
    const res = await request(app).get('/api/equipment');
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('Неверные учетные данные возвращают 401 с нейтральным сообщением', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'non_existent_user', password: 'wrongpassword' });

    expect(res.statusCode).toBe(401);
    expect(res.body.error.message).toBe('Неверный логин или пароль');
  });
});
