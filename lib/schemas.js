// lib/schemas.js
import { z } from 'zod';

const TIPOS = ['servidor', 'banco', 'cache', 'router'];
const STATUS = ['novo', 'ativo', 'upgrade', 'critico'];

export const createSchema = z.object({
  tipo: z.enum(TIPOS),
  pos_x: z.number().int().min(0).max(19),
  pos_y: z.number().int().min(0).max(14),
});

export const updateSchema = z.object({
  status: z.enum(STATUS),
});

export const idSchema = z.coerce.number().int().positive();
