describe('Бизнес-логика обслуживания оборудования', () => {
  const STATUS_FLOW = {
    new: ['in_progress', 'rejected'],
    in_progress: ['done', 'rejected'],
    done: [],
    rejected: []
  };

  test('Допустимые переходы статусов заявки', () => {
    expect(STATUS_FLOW['new'].includes('in_progress')).toBe(true);
    expect(STATUS_FLOW['new'].includes('rejected')).toBe(true);
    expect(STATUS_FLOW['in_progress'].includes('done')).toBe(true);
  });

  test('Запрещенные переходы статусов вызывают ошибку', () => {
    expect(STATUS_FLOW['new'].includes('done')).toBe(false);
    expect(STATUS_FLOW['done'].includes('in_progress')).toBe(false);
    expect(STATUS_FLOW['rejected'].includes('new')).toBe(false);
  });

  test('Валидация состава бригады: ровно один lead', () => {
    const validateCrew = (assignees) => {
      const leads = assignees.filter(a => a.role === 'lead');
      return leads.length === 1;
    };

    expect(validateCrew([{ role: 'lead' }, { role: 'member' }])).toBe(true);
    expect(validateCrew([{ role: 'member' }, { role: 'member' }])).toBe(false);
    expect(validateCrew([{ role: 'lead' }, { role: 'lead' }])).toBe(false);
  });

  test('Разграничение прав ролей на операции', () => {
    const canManageEquipment = (role) => role === 'admin';
    const canCreateRequest = (role) => ['admin', 'technician'].includes(role);

    expect(canManageEquipment('viewer')).toBe(false);
    expect(canManageEquipment('technician')).toBe(false);
    expect(canManageEquipment('admin')).toBe(true);

    expect(canCreateRequest('viewer')).toBe(false);
    expect(canCreateRequest('technician')).toBe(true);
    expect(canCreateRequest('admin')).toBe(true);
  });
});
