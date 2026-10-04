import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as Ctrl from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as V from '../validators/auth.validator.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Слишком много попыток входа. Попробуйте через 15 минут.' } }
});

router.post('/register', validate(V.registerSchema), Ctrl.register);
router.post('/login', loginLimiter, validate(V.loginSchema), Ctrl.login);
router.post('/refresh', Ctrl.refresh);
router.post('/logout', Ctrl.logout);
router.get('/me', authenticate, Ctrl.getMe);

export default router;
