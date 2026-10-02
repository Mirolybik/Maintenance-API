import { Equipment, EquipmentPassport } from '../models/index.js';

export const EquipmentRepo = {
  findAll: async ({ skip = 0, limit = 10, where = {}, order = [['created_at', 'DESC']] }) => {
    const { count, rows } = await Equipment.findAndCountAll({
      where,
      offset: skip,
      limit,
      order,
      include: [{ model: EquipmentPassport, as: 'passport', attributes: { exclude: ['createdAt', 'updatedAt'] } }]
    });
    return { total: count, data: rows };
  },

  findById: async (id) => {
    return await Equipment.findByPk(id, {
      include: [{ model: EquipmentPassport, as: 'passport', attributes: { exclude: ['createdAt', 'updatedAt'] } }]
    });
  },

  findBySerial: async (serialNumber) => {
    return await Equipment.findOne({ where: { serialNumber } });
  },

  create: async (data, options = {}) => {
    return await Equipment.create(data, options);
  },

  update: async (id, data, options = {}) => {
    const item = await Equipment.findByPk(id);
    if (!item) return null;
    return await item.update(data, options);
  },

  delete: async (id, options = {}) => {
    return await Equipment.destroy({ where: { id }, ...options });
  }
};
