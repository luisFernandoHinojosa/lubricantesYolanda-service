import { z } from 'zod';

const sucursalBaseSchema = z.object({
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
    direccion: z.string().optional().nullable(),
    telefono: z.string().optional().nullable(),
    ciudad: z.string().optional().nullable(),
    responsable: z.string().optional().nullable(),
    esta_activo: z.boolean().optional(),
});

export const createSucursalSchema = z.object({
  body: sucursalBaseSchema,
});

export const updateSucursalSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: sucursalBaseSchema.partial().strict(),
});

export const getSucursalSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});

export const listSucursalesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC'),
    sortBy: z.string().optional(),
    search: z.string().optional(),
    esta_activo: z.coerce.boolean().optional(),
  }),
});
