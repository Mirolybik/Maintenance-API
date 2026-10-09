import sequelize, { MaintenanceRequest, RequestStatusHistory, RequestAssignee, Technician } from '../models/index.js';
import { EquipmentService } from './equipment.service.js';
import { RequestRepo } from '../repositories/request.repo.js';
import { NotFoundError, ConflictError, ValidationError, AppError } from '../errors/index.js';

export const STATUS_FLOW = {
  new: ['in_progress', 'rejected'],
  in_progress: ['done', 'rejected'],
  done: [],
  rejected: []
};

export const RequestService = {
  getAll: async (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const { total, data } = await RequestRepo.findAll({ skip, limit });
    return { data, meta: { total, page, limit } };
  },

  getById: async (id) => {
    const req = await RequestRepo.findById(id);
    if (!req) throw new NotFoundError('Заявка не найдена');
    return req;
  },

  getByEquipment: async (eqId) => await RequestRepo.findByEquipment(eqId),

  create: async (data, authorName = 'system') => {
    await EquipmentService.getById(data.equipmentId);
    return await sequelize.transaction(async (t) => {
      const created = await RequestRepo.create({ ...data, author: authorName }, { transaction: t });
      await RequestStatusHistory.create({
        requestId: created.id,
        fromStatus: null,
        toStatus: 'new',
        changedBy: authorName,
        comment: 'Создание заявки'
      }, { transaction: t });
      return created;
    });
  },

  update: async (id, data) => {
    await RequestService.getById(id);
    return await RequestRepo.update(id, data);
  },

  changeStatus: async (id, newStatus, user, comment = '') => {
    return await sequelize.transaction(async (t) => {
      const req = await MaintenanceRequest.findByPk(id, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!req) throw new NotFoundError('Заявка не найдена');

      // Ограничение: техник меняет статус только своих заявок
      if (user && user.role === 'technician') {
        const isAssigned = await RequestAssignee.findOne({
          where: { requestId: id, technicianId: user.technicianId },
          transaction: t
        });
        if (!isAssigned) {
          throw new AppError('Техник может изменять статус только тех заявок, на которые назначен', 403, 'FORBIDDEN');
        }
      }

      if (!STATUS_FLOW[req.status].includes(newStatus)) {
        throw new ConflictError(`Недопустимый переход статуса из ${req.status} в ${newStatus}`);
      }

      if (newStatus === 'in_progress') {
        const count = await RequestAssignee.count({ where: { requestId: id }, transaction: t });
        if (count === 0) {
          throw new ConflictError('Нельзя перевести заявку в статус in_progress без назначенной бригады');
        }
      }

      const prevStatus = req.status;
      await req.update({ status: newStatus }, { transaction: t });

      await RequestStatusHistory.create({
        requestId: id,
        fromStatus: prevStatus,
        toStatus: newStatus,
        changedBy: user ? user.username : 'system',
        comment
      }, { transaction: t });

      return req;
    });
  },

  setAssignees: async (requestId, assignees) => {
    return await sequelize.transaction(async (t) => {
      const req = await MaintenanceRequest.findByPk(requestId, { transaction: t });
      if (!req) throw new NotFoundError('Заявка не найдена');

      const leads = assignees.filter(a => a.role === 'lead');
      if (leads.length !== 1) {
        throw new ValidationError('Бригада должна содержать ровно одного ведущего специалиста (lead)', [
          { field: 'assignees', message: 'Требуется ровно 1 специалист с ролью lead' }
        ]);
      }

      const techIds = assignees.map(a => a.technicianId || a.userId);
      const existingTechs = await Technician.findAll({ where: { id: techIds }, transaction: t });
      if (existingTechs.length !== techIds.length) {
        throw new NotFoundError('Один или несколько указанных специалистов не найдены');
      }

      await RequestAssignee.destroy({ where: { requestId }, transaction: t });

      const records = assignees.map(a => ({
        requestId,
        technicianId: a.technicianId || a.userId,
        role: a.role,
        hours: a.hours || 0
      }));

      await RequestAssignee.bulkCreate(records, { transaction: t });
      return await RequestRepo.findById(requestId, { transaction: t });
    });
  },

  removeAssignee: async (requestId, technicianId) => {
    const deleted = await RequestAssignee.destroy({ where: { requestId, technicianId } });
    if (!deleted) throw new NotFoundError('Специалист не назначен на данную заявку');
    return { success: true };
  },

  getHistory: async (requestId) => {
    await RequestService.getById(requestId);
    return await RequestStatusHistory.findAll({
      where: { requestId },
      order: [['created_at', 'ASC']]
    });
  },

  delete: async (id) => {
    await RequestService.getById(id);
    await RequestRepo.delete(id);
  }
};
