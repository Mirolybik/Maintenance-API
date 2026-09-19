import { Router } from 'express';
import * as Ctrl from '../controllers/equipment.controller.js';
import { validate } from '../middlewares/validate.js';
import * as V from '../validators/equipment.validator.js';

const router = Router();
router.get('/', validate(V.listQuerySchema), Ctrl.getEquipments);
router.post('/', validate(V.createEquipmentSchema), Ctrl.createEquipment);
router.get('/:id', validate(V.getEquipmentSchema), Ctrl.getEquipment);
router.patch('/:id', validate(V.updateEquipmentSchema), Ctrl.updateEquipment);
router.delete('/:id', validate(V.getEquipmentSchema), Ctrl.deleteEquipment);

import * as ReqCtrl from "../controllers/request.controller.js";
router.get("/:id/requests", validate(V.getEquipmentSchema), ReqCtrl.getByEquip);

router.get("/:id/weather", validate(V.getEquipmentSchema), Ctrl.getWeather);

export default router;
