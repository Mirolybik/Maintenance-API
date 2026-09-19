import { z } from 'zod';
import { listQuerySchema } from './equipment.validator.js';

export const createRequestSchema = z.object({
  body: z.object({
    equipmentId: z.string().uuid(),
    title: z.string().min(5).max(120),
    description: z.string().max(2000),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    plannedAt: z.string().datetime().optional()
  }).strict()
});

export const updateRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(5).max(120).optional(),
    description: z.string().max(2000).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    plannedAt: z.string().datetime().optional()
  }).strict()
});

export const updateStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ status: z.enum(['new', 'in_progress', 'done', 'rejected']) }).strict()
});

export const getRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

export { listQuerySchema };
