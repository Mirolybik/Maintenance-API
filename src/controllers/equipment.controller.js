import { EquipmentService } from '../services/equipment.service.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getEquipments = catchAsync(async (req, res) => {
  res.json(await EquipmentService.getAll(req.query.page, req.query.limit));
});

export const getEquipment = catchAsync(async (req, res) => {
  res.json(await EquipmentService.getById(req.params.id));
});

export const createEquipment = catchAsync(async (req, res) => {
  const item = await EquipmentService.create(req.body);
  res.status(201).location(`/api/equipment/${item.id}`).json(item);
});

export const updateEquipment = catchAsync(async (req, res) => {
  res.json(await EquipmentService.update(req.params.id, req.body));
});

export const deleteEquipment = catchAsync(async (req, res) => {
  await EquipmentService.delete(req.params.id);
  res.status(204).send();
});
