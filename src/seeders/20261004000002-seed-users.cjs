'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    const passwordHash = bcrypt.hashSync('Password123!', 10);

    await queryInterface.bulkInsert('users', [
      {
        id: '11111111-1111-1111-1111-111111111111',
        username: 'admin',
        email: 'admin@windpark.local',
        password_hash: passwordHash,
        role: 'admin',
        technician_id: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        username: 'technician',
        email: 'tech@windpark.local',
        password_hash: passwordHash,
        role: 'technician',
        technician_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        username: 'viewer',
        email: 'viewer@windpark.local',
        password_hash: passwordHash,
        role: 'viewer',
        technician_id: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', null, {});
  }
};
