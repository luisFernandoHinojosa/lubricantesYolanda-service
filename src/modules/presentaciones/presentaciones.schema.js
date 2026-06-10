import { z } from 'zod';

const presentacionBaseSchema = z.object({
  id_producto: z.string().uuid('ID de producto inválido.'),
  id_unidad_medida: z.string().uuid('ID de unidad de medida inválido.').optional().nullable(),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  sku: z.string().optional().nullable(),
  codigo_barras: z.string().optional().nullable(),
  factor_conversion: z.coerce.number().positive('El factor de conversión debe ser positivo.'),
  precio_especial: z.coerce.number().nonnegative('El precio especial debe ser positivo.').optional().default(0),
  esta_activo: z.boolean().default(true),
});

export const createPresentacionSchema = z.object({
  body: presentacionBaseSchema,
});

export const updatePresentacionSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: presentacionBaseSchema.partial().strict(),
});

export const getPresentacionSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});

export const listPresentacionesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC'),
    sortBy: z.string().optional(),
    search: z.string().optional(),
    esta_activo: z.coerce.boolean().optional(),
  }),
});
