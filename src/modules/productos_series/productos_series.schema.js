import { z } from 'zod';

const productoSerieBaseSchema = z.object({
  id_lote: z.string().uuid('ID de lote inválido.'),
  id_ubicacion: z.string().uuid('ID de ubicación inválido.').optional().nullable(),
  numero_serie: z.string().min(1, 'El número de serie es requerido.'),
  estado: z.enum(['DISPONIBLE', 'VENDIDO', 'GARANTIA']).default('DISPONIBLE'),
});

export const createProductoSerieSchema = z.object({
  body: productoSerieBaseSchema,
});

export const updateProductoSerieSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: productoSerieBaseSchema.partial().strict(),
});

export const getProductoSerieSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});

export const listProductosSeriesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC'),
    sortBy: z.string().optional(),
    search: z.string().optional(),
    estado: z.enum(['DISPONIBLE', 'VENDIDO', 'GARANTIA']).optional(),
  }),
});
