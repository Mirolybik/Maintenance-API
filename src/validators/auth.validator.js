import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(6).max(100)
  }).strict()
});

export const loginSchema = z.object({
  body: z.object({
    identifier: z.string().min(3),
    password: z.string().min(1)
  }).strict()
});
