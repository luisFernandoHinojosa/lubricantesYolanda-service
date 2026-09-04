import { z } from 'zod';

const detalleProformaSchema = z.object({
  id_producto: z.string().uuid('id_producto debe ser un UUID válido'),
  id_presentacion: z.string().uuid('id_presentacion debe ser un UUID válido').optional().nullable(),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0').or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)),
  precio_unitario: z.number().nonnegative().optional(),
  monto_descuento: z.number().nonnegative().optional().default(0),
});

export const proformaBaseSchema = z.object({
  id_cliente: z.string().uuid('id_cliente debe ser un UUID válido').optional().nullable(),
  items: z.array(detalleProformaSchema).min(1, 'Debe incluir al menos un ítem.'),
  tipo_descuento_global: z.enum(['PORCENTAJE', 'FIJO', 'NINGUNO']).optional().default('NINGUNO'),
  valor_descuento_global: z.number().nonnegative().optional().default(0),
  validez_dias: z.number().int().positive().optional().default(15),
  notas: z.string().optional(),
}).refine(data => {
  // Validaciones cruzadas
  if (data.tipo_descuento_global !== 'NINGUNO' && (data.valor_descuento_global === undefined || data.valor_descuento_global === null)) {
    return false;
  }
  if (data.tipo_descuento_global === 'PORCENTAJE' && data.valor_descuento_global > 100) {
    return false;
  }
  return true;
}, {
  message: 'valor_descuento_global es inválido o no corresponde al tipo_descuento_global.',
  path: ['valor_descuento_global']
});

export const createProformaSchema = z.object({
  body: proformaBaseSchema,
});

export const updateProformaSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: proformaBaseSchema,
});

export const getProformaSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});

export const listProformasSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC'),
    sortBy: z.string().optional(),
    search: z.string().optional(),
    estado: z.enum(['PENDIENTE', 'FACTURADA', 'VENCIDA', 'ANULADA']).optional(),
    id_cliente: z.string().uuid().optional(),
    id_usuario: z.string().uuid().optional(),
    desde: z.string().optional(),
    hasta: z.string().optional(),
  }),
});

export const facturarProformaSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: z.object({
    id_sesion_caja: z.string().uuid('id_sesion_caja es obligatorio'),
    metodo_pago: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'QR']),
    monto_pagado: z.number().nonnegative().or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)),
    notas_adicionales: z.string().optional(),
  }),
});
