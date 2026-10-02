import { Router } from 'express';
import * as Ctrl from '../controllers/report.controller.js';

const router = Router();
router.get('/:id/summary', Ctrl.getSiteSummary);
export default router;
