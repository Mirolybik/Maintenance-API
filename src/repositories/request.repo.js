import { MaintenanceRequest, Technician } from '../models/index.js';

export const RequestRepo = {
  findAll: async ({ skip = 0, limit = 10, where = {}, order = [['created_at', 'DESC']] }) => {
    const { count, rows } = await MaintenanceRequest.findAndCountAll({
      where,
      offset: skip,
      limit,
      order,
      include: [
        {
          model: Technician,
          as: 'assignees',
          through: { attributes: ['role', 'hours'] },
          attributes: ['id', 'fullName', 'specialization', 'employeeNumber']
        }
      ]
    });
    return { total: count, data: rows };
  },

  findById: async (id, options = {}) => {
    return await MaintenanceRequest.findByPk(id, {
      include: [
        {
          model: Technician,
          as: 'assignees',
          through: { attributes: ['role', 'hours'] },
          attributes: ['id', 'fullName', 'specialization', 'employeeNumber']
        }
      ],
      ...options
    });
  },

  findByEquipment: async (equipmentId) => {
    return await MaintenanceRequest.findAll({ where: { equipmentId } });
  },

  create: async (data, options = {}) => {
    return await MaintenanceRequest.create(data, options);
  },

  update: async (id, data, options = {}) => {
    const item = await MaintenanceRequest.findByPk(id, options);
    if (!item) return null;
    return await item.update(data, options);
  },

  delete: async (id, options = {}) => {
    return await MaintenanceRequest.destroy({ where: { id }, ...options });
  }
};
