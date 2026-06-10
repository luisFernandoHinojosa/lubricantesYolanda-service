import { z } from 'zod';

const loteBaseSchema = z.object({
  id_producto: z.string().uuid('ID de producto inválido.'),
  id_proveedor: z.string().uuid('ID de proveedor inválido.').optional().nullable(),
  codigo_lote: z.string().min(1, 'El código de lote es requerido.'),
  costo_compra_unitario: z.coerce.number().nonnegative('El costo debe ser positivo.').optional().default(0),
  fecha_vencimiento: z.coerce.date().optional().nullable(),
  fecha_ingreso: z.coerce.date().default(() => new Date()),
});

export const createLoteSchema = z.object({
  body: loteBaseSchema,
});

export const updateLoteSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: loteBaseSchema.partial().strict(),
});

export const getLoteSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});

export const listLotesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC'),
    sortBy: z.string().optional(),
    search: z.string().optional(),
  }),
});
