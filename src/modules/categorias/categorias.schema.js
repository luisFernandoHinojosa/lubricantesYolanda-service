import { z } from 'zod';

const categoriaBaseSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  descripcion: z.string().optional(),
  esta_activo: z.boolean().optional(),
});

export const createCategoriaSchema = z.object({
  body: categoriaBaseSchema,
});

export const updateCategoriaSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: categoriaBaseSchema.partial().strict(),
});

export const getCategoriaSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});

export const listCategoriasSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC'),
    sortBy: z.string().optional(),
    search: z.string().optional(),
    esta_activo: z.coerce.boolean().optional(),
  }),
});
