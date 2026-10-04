import { Router } from 'express';
import * as Ctrl from '../controllers/equipment.controller.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import * as V from '../validators/equipment.validator.js';

const router = Router();
router.use(authenticate);

router.get('/', validate(V.listQuerySchema), Ctrl.getEquipments);
router.post('/', authorize('admin'), validate(V.createEquipmentSchema), Ctrl.createEquipment);
router.get('/:id', validate(V.getEquipmentSchema), Ctrl.getEquipment);
router.patch('/:id', authorize('admin'), validate(V.updateEquipmentSchema), Ctrl.updateEquipment);
router.delete('/:id', authorize('admin'), validate(V.getEquipmentSchema), Ctrl.deleteEquipment);
router.get('/:id/weather', validate(V.getEquipmentSchema), Ctrl.getWeather);

export default router;
