'use strict';
const crypto = require('crypto');

module.exports = {
  async up(queryInterface) {
    const site1 = crypto.randomUUID();
    const site2 = crypto.randomUUID();

    await queryInterface.bulkInsert('sites', [
      { id: site1, name: 'Ветропарк Северный', code: 'WIND-NORTH', region: 'Мурманская область', lat: 68.97, lon: 33.08 },
      { id: site2, name: 'Солнечная станция Южная', code: 'SOLAR-SOUTH', region: 'Краснодарский край', lat: 45.03, lon: 38.97 }
    ]);

    const techIds = [
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID()
    ];

    await queryInterface.bulkInsert('technicians', [
      { id: techIds[0], full_name: 'Иванов Иван Иванович', specialization: 'Главный механик', employee_number: 'EMP-001' },
      { id: techIds[1], full_name: 'Петров Петр Сергеевич', specialization: 'Электромонтер', employee_number: 'EMP-002' },
      { id: techIds[2], full_name: 'Сидоров Алексей Михайлович', specialization: 'Инженер АСУ ТП', employee_number: 'EMP-003' },
      { id: techIds[3], full_name: 'Смирнов Дмитрий Павлович', specialization: 'Техник-диагност', employee_number: 'EMP-004' },
      { id: techIds[4], full_name: 'Кузнецов Артем Игоревич', specialization: 'Монтажник ВЛЭП', employee_number: 'EMP-005' }
    ]);

    const equipIds = [];
    const equipData = [
      { name: 'Турбина ВЭУ-1', type: 'turbine', sn: 'TRB-001', site: site1, lat: 68.97, lon: 33.08 },
      { name: 'Турбина ВЭУ-2', type: 'turbine', sn: 'TRB-002', site: site1, lat: 68.98, lon: 33.09 },
      { name: 'Инверторная подстанция 1', type: 'inverter', sn: 'INV-101', site: site1, lat: 68.96, lon: 33.07 },
      { name: 'Датчик метеорологический', type: 'sensor', sn: 'SNS-501', site: site2, lat: 45.03, lon: 38.97 },
      { name: 'Инвертор Солнечный СИ-1', type: 'inverter', sn: 'INV-201', site: site2, lat: 45.04, lon: 38.98 },
      { name: 'Главная трансформаторная подстанция', type: 'substation', sn: 'SUB-901', site: site2, lat: 45.02, lon: 38.96 }
    ];

    const passports = [];
    for (const e of equipData) {
      const id = crypto.randomUUID();
      equipIds.push(id);
      passports.push({
        id: crypto.randomUUID(),
        equipment_id: id,
        manufacturer: 'Siemens Energy / Vestas',
        model: 'Model-X2026',
        nominal_power: 2500.0,
        last_inspection_date: '2026-05-15'
      });
    }

    await queryInterface.bulkInsert('equipment', equipData.map((e, idx) => ({
      id: equipIds[idx],
      site_id: e.site,
      name: e.name,
      type: e.type,
      serial_number: e.sn,
      location: JSON.stringify({ lat: e.lat, lon: e.lon }),
      status: 'operational',
      installed_at: new Date('2024-01-15')
    })));

    await queryInterface.bulkInsert('equipment_passports', passports);

    const requests = [];
    const history = [];
    const assignees = [];
    const statuses = ['new', 'in_progress', 'done', 'rejected'];
    const priorities = ['low', 'medium', 'high', 'critical'];

    for (let i = 1; i <= 24; i++) {
      const reqId = crypto.randomUUID();
      const eqId = equipIds[i % equipIds.length];
      const status = statuses[i % statuses.length];
      const priority = priorities[i % priorities.length];

      requests.push({
        id: reqId,
        equipment_id: eqId,
        title: `Регламентная заявка #${i} на обслуживание`,
        description: `Проведение комплексного планового ТО согласно регламенту #${i}.`,
        priority,
        status,
        author: 'Диспетчер Смены',
        created_at: new Date(Date.now() - (30 - i) * 86400000),
        updated_at: new Date()
      });

      history.push({
        id: crypto.randomUUID(),
        request_id: reqId,
        from_status: null,
        to_status: 'new',
        changed_by: 'system',
        comment: 'Автоматическая регистрация заявки'
      });

      if (status !== 'new') {
        history.push({
          id: crypto.randomUUID(),
          request_id: reqId,
          from_status: 'new',
          to_status: status,
          changed_by: 'Оператор',
          comment: `Перевод в статус ${status}`
        });

        assignees.push({
          request_id: reqId,
          technician_id: techIds[0],
          role: 'lead',
          hours: 8.5
        });
        assignees.push({
          request_id: reqId,
          technician_id: techIds[1],
          role: 'member',
          hours: 6.0
        });
      }
    }

    await queryInterface.bulkInsert('maintenance_requests', requests);
    await queryInterface.bulkInsert('request_status_history', history);
    await queryInterface.bulkInsert('request_assignees', assignees);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('request_assignees', null, {});
    await queryInterface.bulkDelete('request_status_history', null, {});
    await queryInterface.bulkDelete('maintenance_requests', null, {});
    await queryInterface.bulkDelete('equipment_passports', null, {});
    await queryInterface.bulkDelete('equipment', null, {});
    await queryInterface.bulkDelete('technicians', null, {});
    await queryInterface.bulkDelete('sites', null, {});
  }
};
