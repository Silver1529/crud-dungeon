// lib/schemas.js
import { z } from 'zod';

const TIPOS = ['servidor', 'banco', 'cache', 'router'];
const STATUS = ['novo', 'ativo', 'upgrade', 'critico'];

export const createSchema = z.object({
  tipo: z.enum(TIPOS),
  pos_x: z.number().int().min(0).max(19),
  pos_y: z.number().int().min(0).max(14),
});

// EDUCATIONAL: PUT agora não exige body — server calcula o próximo level.
// Ainda aceitamos `status` opcional pra compat retroativa (clientes antigos).
export const updateSchema = z.object({
  status: z.enum(STATUS).optional(),
});

export const idSchema = z.coerce.number().int().positive();
