import { z } from 'zod';

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

export const setAssigneesSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    assignees: z.array(z.object({
      technicianId: z.string().uuid(),
      role: z.enum(['lead', 'member']),
      hours: z.number().min(0).max(1000).default(0)
    }).strict()).min(1)
  }).strict()
});

export const listQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10)
  }).passthrough()
});
