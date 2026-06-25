import { z } from 'zod';

const loteBaseSchema = z.object({
  id_producto: z.string().uuid('ID de producto inválido.'),
  id_proveedor: z.string().uuid('ID de proveedor inválido.').optional().nullable(),
  codigo_lote: z.string().optional(),
  costo_compra_unitario: z.coerce.number().nonnegative('El costo debe ser positivo.').optional().default(0),
  fecha_vencimiento: z.coerce.date().optional().nullable(),
  fecha_ingreso: z.coerce.date().default(() => new Date()),
  distribuciones: z.array(
    z.object({
      id_ubicacion: z.string().uuid().optional().nullable(),
      id_ubicacion_fisica: z.string().uuid().optional().nullable(),
      cantidad: z.coerce.number().min(0.01, 'La cantidad debe ser mayor a 0'),
    })
  ).optional(),
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
