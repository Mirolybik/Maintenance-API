import { z } from 'zod';

export const createEquipmentSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(100),
    type: z.enum(['turbine', 'inverter', 'sensor', 'substation']),
    serialNumber: z.string().min(1),
    location: z.object({ lat: z.number(), lon: z.number() }).strict(),
    status: z.enum(['operational', 'maintenance', 'fault', 'decommissioned'])
  }).strict()
});

export const updateEquipmentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: createEquipmentSchema.shape.body.partial().strict()
});

export const getEquipmentSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

export const listQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10)
  }).passthrough()
});
