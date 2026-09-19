import request from 'supertest';
import app from '../src/app.js';

describe('API Tests', () => {
  it('GET /api/health должен вернуть 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('Отлов битого JSON: должен вернуть 400', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set('Content-Type', 'application/json')
      .send('{"name": "Broken JSON');
      
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('Строгая валидация Zod: запрет неизвестных полей (--foo)', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .send({
        name: "Test Eq", type: "sensor", serialNumber: "123",
        location: { lat: 0, lon: 0 }, status: "operational",
        foo: "bar" // Лишнее поле
      });
      
    expect(res.statusCode).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toContain('foo');
  });

  it('Успешное создание оборудования', async () => {
    const eq = { name: "Test Eq", type: "sensor", serialNumber: "12345", location: { lat: 10, lon: 20 }, status: "operational" };
    const res = await request(app).post('/api/equipment').send(eq);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});
