import { z } from 'zod';

export const reportQuerySchema = z.object({
  query: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    minRequests: z.coerce.number().min(0).default(0),
    sortBy: z.enum(['totalRequests', 'closedRequests', 'totalHours', 'lastMaintenanceDate']).default('totalRequests'),
    order: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC')
  }).strict()
});
