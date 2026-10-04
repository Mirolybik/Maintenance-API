import { Router } from 'express';
import * as Ctrl from '../controllers/report.controller.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { reportQuerySchema } from '../validators/report.validator.js';

const router = Router();
router.use(authenticate);
router.get('/equipment-load', validate(reportQuerySchema), Ctrl.getEquipmentLoad);
export default router;
