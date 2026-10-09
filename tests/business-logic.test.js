import { jest } from '@jest/globals';

// Подменяем слой данных: тестируем реальную бизнес-логику сервиса без БД
const tx = { LOCK: { UPDATE: 'UPDATE' } };
const m = {
  MaintenanceRequest: { findByPk: jest.fn() },
  RequestStatusHistory: { create: jest.fn() },
  RequestAssignee: { findOne: jest.fn(), count: jest.fn(), destroy: jest.fn(), bulkCreate: jest.fn() },
  Technician: { findAll: jest.fn() }
};

jest.unstable_mockModule('../src/models/index.js', () => ({
  default: { transaction: (cb) => cb(tx) },
  ...m
}));
jest.unstable_mockModule('../src/repositories/request.repo.js', () => ({
  RequestRepo: { findById: jest.fn().mockResolvedValue({ id: 'r1' }) }
}));
jest.unstable_mockModule('../src/services/equipment.service.js', () => ({
  EquipmentService: { getById: jest.fn() }
}));

const { STATUS_FLOW, RequestService } = await import('../src/services/request.service.js');
const { authorize } = await import('../src/middlewares/auth.middleware.js');

const reqWithStatus = (status) => ({ status, update: jest.fn().mockResolvedValue(true) });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Переходы статусов заявки (STATUS_FLOW)', () => {
  test.each([
    ['new', 'in_progress'],
    ['new', 'rejected'],
    ['in_progress', 'done'],
    ['in_progress', 'rejected']
  ])('%s -> %s разрешён', (from, to) => {
    expect(STATUS_FLOW[from]).toContain(to);
  });

  test.each([
    ['new', 'done'],
    ['done', 'in_progress'],
    ['done', 'new'],
    ['rejected', 'new']
  ])('%s -> %s запрещён', (from, to) => {
    expect(STATUS_FLOW[from]).not.toContain(to);
  });
});

describe('RequestService.changeStatus', () => {
  const admin = { role: 'admin', username: 'admin' };
  const tech = { role: 'technician', username: 'technician', technicianId: 't1' };

  test('недопустимый переход даёт 409', async () => {
    m.MaintenanceRequest.findByPk.mockResolvedValue(reqWithStatus('new'));
    await expect(RequestService.changeStatus('r1', 'done', admin)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('в in_progress нельзя без бригады (409)', async () => {
    m.MaintenanceRequest.findByPk.mockResolvedValue(reqWithStatus('new'));
    m.RequestAssignee.count.mockResolvedValue(0);
    await expect(RequestService.changeStatus('r1', 'in_progress', admin)).rejects.toMatchObject({ statusCode: 409 });
    expect(m.RequestStatusHistory.create).not.toHaveBeenCalled();
  });

  test('техник не назначен на заявку: 403', async () => {
    m.MaintenanceRequest.findByPk.mockResolvedValue(reqWithStatus('new'));
    m.RequestAssignee.findOne.mockResolvedValue(null);
    await expect(RequestService.changeStatus('r1', 'in_progress', tech)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('назначенный техник меняет статус, запись попадает в историю', async () => {
    const r = reqWithStatus('new');
    m.MaintenanceRequest.findByPk.mockResolvedValue(r);
    m.RequestAssignee.findOne.mockResolvedValue({});
    m.RequestAssignee.count.mockResolvedValue(2);
    await RequestService.changeStatus('r1', 'in_progress', tech, 'старт');
    expect(r.update).toHaveBeenCalledWith({ status: 'in_progress' }, { transaction: tx });
    expect(m.RequestStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ fromStatus: 'new', toStatus: 'in_progress', changedBy: 'technician' }),
      { transaction: tx }
    );
  });

  test('админ может менять статус любой заявки без проверки назначения', async () => {
    m.MaintenanceRequest.findByPk.mockResolvedValue(reqWithStatus('in_progress'));
    await RequestService.changeStatus('r1', 'done', admin);
    expect(m.RequestAssignee.findOne).not.toHaveBeenCalled();
  });

  test('несуществующая заявка: 404', async () => {
    m.MaintenanceRequest.findByPk.mockResolvedValue(null);
    await expect(RequestService.changeStatus('x', 'done', admin)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('RequestService.setAssignees: правила бригады', () => {
  beforeEach(() => {
    m.MaintenanceRequest.findByPk.mockResolvedValue({ id: 'r1' });
    m.Technician.findAll.mockImplementation(async ({ where }) => where.id.map((id) => ({ id })));
  });

  test('ровно один lead: бригада сохраняется', async () => {
    await RequestService.setAssignees('r1', [
      { technicianId: 't1', role: 'lead', hours: 4 },
      { technicianId: 't2', role: 'member', hours: 2 }
    ]);
    expect(m.RequestAssignee.bulkCreate).toHaveBeenCalledTimes(1);
  });

  test('без lead: 422', async () => {
    await expect(
      RequestService.setAssignees('r1', [{ technicianId: 't1', role: 'member' }])
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(m.RequestAssignee.bulkCreate).not.toHaveBeenCalled();
  });

  test('два lead: 422', async () => {
    await expect(
      RequestService.setAssignees('r1', [
        { technicianId: 't1', role: 'lead' },
        { technicianId: 't2', role: 'lead' }
      ])
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  test('неизвестный специалист: 404', async () => {
    m.Technician.findAll.mockResolvedValue([]);
    await expect(
      RequestService.setAssignees('r1', [{ technicianId: 'nope', role: 'lead' }])
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('Проверка прав по ролям (middleware authorize)', () => {
  const run = (allowed, role) => {
    const next = jest.fn();
    authorize(...allowed)({ user: role ? { role } : undefined }, {}, next);
    return next.mock.calls[0][0];
  };

  test('admin допускается к операциям администратора', () => {
    expect(run(['admin'], 'admin')).toBeUndefined();
  });

  test.each(['viewer', 'technician'])('%s не допускается к операциям администратора (403)', (role) => {
    expect(run(['admin'], role)).toMatchObject({ statusCode: 403 });
  });

  test('viewer не может создавать заявки, technician и admin могут', () => {
    expect(run(['technician', 'admin'], 'viewer')).toMatchObject({ statusCode: 403 });
    expect(run(['technician', 'admin'], 'technician')).toBeUndefined();
    expect(run(['technician', 'admin'], 'admin')).toBeUndefined();
  });

  test('без пользователя: 403', () => {
    expect(run(['admin'], null)).toMatchObject({ statusCode: 403 });
  });
});
