import { RequestRepo } from '../repositories/request.repo.js';
import { EquipmentService } from './equipment.service.js';
import { NotFoundError, ConflictError } from '../errors/index.js';

const STATUS_FLOW = {
  new: ['in_progress', 'rejected'],
  in_progress: ['done', 'rejected'],
  done: [],
  rejected: []
};

export const RequestService = {
  getAll: async (page, limit) => {
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
  create: async (data) => {
    await EquipmentService.getById(data.equipmentId); // 404 если нет оборудования
    return await RequestRepo.create(data);
  },
  update: async (id, data) => {
    await RequestService.getById(id);
    return await RequestRepo.update(id, data);
  },
  changeStatus: async (id, newStatus) => {
    const req = await RequestService.getById(id);
    if (!STATUS_FLOW[req.status].includes(newStatus)) {
      throw new ConflictError(`Недопустимый переход статуса из ${req.status} в ${newStatus}`);
    }
    return await RequestRepo.update(id, { status: newStatus });
  },
  delete: async (id) => {
    await RequestService.getById(id);
    await RequestRepo.delete(id);
  }
};
