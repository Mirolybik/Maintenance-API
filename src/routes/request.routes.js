import { Router } from 'express';
import * as Ctrl from '../controllers/request.controller.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import * as V from '../validators/request.validator.js';

const router = Router();
router.use(authenticate);

router.get('/', validate(V.listQuerySchema), Ctrl.getReqs);
router.post('/', authorize('technician', 'admin'), validate(V.createRequestSchema), Ctrl.createReq);
router.get('/:id', validate(V.getRequestSchema), Ctrl.getReq);
router.patch('/:id', authorize('technician', 'admin'), validate(V.updateRequestSchema), Ctrl.updateReq);
router.patch('/:id/status', authorize('technician', 'admin'), validate(V.updateStatusSchema), Ctrl.changeStatus);
router.delete('/:id', authorize('admin'), validate(V.getRequestSchema), Ctrl.deleteReq);

router.post('/:id/assignees', authorize('admin'), validate(V.setAssigneesSchema), Ctrl.setAssignees);
router.delete('/:id/assignees/:userId', authorize('admin'), Ctrl.removeAssignee);
router.get('/:id/history', validate(V.getRequestSchema), Ctrl.getHistory);

export default router;
