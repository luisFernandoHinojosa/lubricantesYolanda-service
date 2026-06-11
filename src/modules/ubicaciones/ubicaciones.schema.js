import { z } from 'zod';

const ubicacionBaseSchema = z.object({
  id_sucursal: z.string().uuid('ID de sucursal inválido'),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  descripcion: z.string().optional(),
  tipo_area: z.enum(['VENTA', 'DEPOSITO', 'MERMA'], {
    errorMap: () => ({ message: 'El tipo de área debe ser VENTA, DEPOSITO o MERMA.' })
  }),
  esta_activo: z.boolean().optional(),
});

export const createUbicacionSchema = z.object({
  body: ubicacionBaseSchema,
});

export const updateUbicacionSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: ubicacionBaseSchema.partial().strict(),
});

export const getUbicacionSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});

export const listUbicacionesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC'),
    sortBy: z.string().optional(),
    search: z.string().optional(),
    esta_activo: z.coerce.boolean().optional(),
  }),
});
