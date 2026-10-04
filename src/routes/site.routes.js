import { Router } from 'express';
import * as Ctrl from '../controllers/report.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate);
router.get('/:id/summary', Ctrl.getSiteSummary);
export default router;
