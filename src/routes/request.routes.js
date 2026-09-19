import { Router } from 'express';
import * as Ctrl from '../controllers/request.controller.js';
import { validate } from '../middlewares/validate.js';
import * as V from '../validators/request.validator.js';

const router = Router();
router.get('/', validate(V.listQuerySchema), Ctrl.getReqs);
router.post('/', validate(V.createRequestSchema), Ctrl.createReq);
router.get('/:id', validate(V.getRequestSchema), Ctrl.getReq);
router.patch('/:id', validate(V.updateRequestSchema), Ctrl.updateReq);
router.patch('/:id/status', validate(V.updateStatusSchema), Ctrl.changeStatus);
router.delete('/:id', validate(V.getRequestSchema), Ctrl.deleteReq);
export default router;
