import { RequestService } from '../services/request.service.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getReqs = catchAsync(async (req, res) => res.json(await RequestService.getAll(req.query.page, req.query.limit)));
export const getReq = catchAsync(async (req, res) => res.json(await RequestService.getById(req.params.id)));
export const createReq = catchAsync(async (req, res) => {
  const item = await RequestService.create(req.body);
  res.status(201).location(`/api/requests/${item.id}`).json(item);
});
export const updateReq = catchAsync(async (req, res) => res.json(await RequestService.update(req.params.id, req.body)));
export const changeStatus = catchAsync(async (req, res) => res.json(await RequestService.changeStatus(req.params.id, req.body.status)));
export const deleteReq = catchAsync(async (req, res) => {
  await RequestService.delete(req.params.id);
  res.status(204).send();
});
export const getByEquip = catchAsync(async (req, res) => res.json(await RequestService.getByEquipment(req.params.id)));
