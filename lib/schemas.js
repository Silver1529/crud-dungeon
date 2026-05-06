// lib/schemas.js
import { z } from 'zod';

const TIPOS = ['servidor', 'banco', 'cache', 'router'];
const STATUS = ['novo', 'ativo', 'upgrade', 'critico'];

// EDUCATIONAL: pos_x/y batem com COLS/ROWS em lib/game/constants.ts (40×28).
// Aumentou? Atualizar os max() abaixo. Mantemos hardcoded pra não cruzar TS↔JS.
export const createSchema = z.object({
  tipo: z.enum(TIPOS),
  pos_x: z.number().int().min(0).max(39),
  pos_y: z.number().int().min(0).max(27),
});

// EDUCATIONAL: PUT agora não exige body — server calcula o próximo level.
// Ainda aceitamos `status` opcional pra compat retroativa (clientes antigos).
export const updateSchema = z.object({
  status: z.enum(STATUS).optional(),
});

export const idSchema = z.coerce.number().int().positive();
