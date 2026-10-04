import { Router } from 'express';
import sequelize from '../config/db.js';

const router = Router();

router.get('/live', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

router.get('/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ status: 'ready', db: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'not_ready', db: 'disconnected', error: error.message });
  }
});

export default router;
