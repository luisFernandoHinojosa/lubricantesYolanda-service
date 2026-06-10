import { z } from 'zod';

const unidadMedidaBaseSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  abreviatura: z.string().min(1, 'La abreviatura es requerida.'),
  esta_activo: z.boolean().optional(),
});

export const createUnidadMedidaSchema = z.object({
  body: unidadMedidaBaseSchema,
});

export const updateUnidadMedidaSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: unidadMedidaBaseSchema.partial().strict(),
});

export const getUnidadMedidaSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});

export const listUnidadMedidasSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC'),
    sortBy: z.string().optional(),
    search: z.string().optional(),
    esta_activo: z.coerce.boolean().optional(),
  }),
});
