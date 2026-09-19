import { EquipmentRepo } from '../repositories/equipment.repo.js';
import { NotFoundError, ConflictError } from '../errors/index.js';

export const EquipmentService = {
  getAll: async (page, limit) => {
    const skip = (page - 1) * limit;
    const { total, data } = await EquipmentRepo.findAll({ skip, limit });
    return { data, meta: { total, page, limit } };
  },
  getById: async (id) => {
    const item = await EquipmentRepo.findById(id);
    if (!item) throw new NotFoundError('Оборудование не найдено');
    return item;
  },
  create: async (data) => {
    const existing = await EquipmentRepo.findBySerial(data.serialNumber);
    if (existing) throw new ConflictError('Серийный номер уже используется');
    return await EquipmentRepo.create(data);
  },
  update: async (id, data) => {
    await EquipmentService.getById(id);
    if (data.serialNumber) {
      const existing = await EquipmentRepo.findBySerial(data.serialNumber);
      if (existing && existing.id !== id) throw new ConflictError('Серийный номер уже используется');
    }
    return await EquipmentRepo.update(id, data);
  },
  delete: async (id) => {
    await EquipmentService.getById(id);
    const { RequestRepo } = await import("../repositories/request.repo.js");
    const reqs = await RequestRepo.findByEquipment(id);
    if (reqs.some(r => r.status === "new" || r.status === "in_progress")) throw new ConflictError("Нельзя удалить оборудование с открытыми заявками");

    await EquipmentRepo.delete(id);
  }
};
