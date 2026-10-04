import { User, Technician } from '../models/index.js';
import { Op } from 'sequelize';

export const UserRepo = {
  findById: async (id) => {
    return await User.findByPk(id, {
      include: [{ model: Technician, as: 'technician' }],
      attributes: { exclude: ['passwordHash'] }
    });
  },

  findByLoginOrEmail: async (identifier) => {
    return await User.findOne({
      where: {
        [Op.or]: [{ username: identifier }, { email: identifier }]
      }
    });
  },

  create: async (data) => {
    return await User.create(data);
  }
};
