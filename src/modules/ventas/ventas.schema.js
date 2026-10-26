// src/modules/ventas/ventas.schema.js
import { z } from 'zod';
import { clienteVentaSchema } from '../clientes/clientes.schema.js';
import { METODOS_PAGO_VALIDOS, CI_CLIENTE_GENERICO } from '../../constants/business.constants.js';

// Reutiliza y reexporta el schema del cliente desde el módulo de clientes
export { clienteVentaSchema };

const idSchema = (campo) => z.guid(`${campo} inválido`);

const itemVentaSchema = z.object({
  id_producto: idSchema('id_producto'),
  id_presentacion: idSchema('id_presentacion').nullable().optional(),
  cantidad: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  monto_descuento: z.coerce.number().min(0, 'El descuento no puede ser negativo').default(0),
  numero_serie: z.string().trim().min(1, 'El número de serie no puede estar vacío').nullable().optional(),
});

const pagoVentaSchema = z.object({
  metodo_pago: z.enum(METODOS_PAGO_VALIDOS, `Debe ser uno de: ${METODOS_PAGO_VALIDOS.join(', ')}`),
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
  referencia: z.string().max(255).nullable().optional(),
});

const crearVentaBodySchema = z
  .object({
    // Opcional: si se envía debe coincidir con la sesión abierta del cajero
    id_sesion_caja: idSchema('id_sesion_caja').optional(),
    // El cliente se identifica solo por CI/NIT. Sin cliente → cliente genérico.
    cliente: clienteVentaSchema.nullable().optional(),
    items: z.array(itemVentaSchema).min(1, 'Debe incluir al menos un producto'),
    tipo_descuento_global: z.enum(['PORCENTAJE', 'FIJO', 'NINGUNO']).nullable().optional()
      .transform((v) => v || 'NINGUNO'),
    valor_descuento_global: z.coerce.number().min(0, 'El descuento no puede ser negativo').default(0),
    pagos: z.array(pagoVentaSchema).min(1, 'Debe incluir al menos un método de pago'),
    notas: z.string().max(500).nullable().optional(),
    facturar: z.boolean().default(false),
    // Porcentaje que se cobra adicional por emitir factura (lo ingresa el cajero; 0 = sin recargo)
    porcentaje_recargo_iva: z.coerce
      .number({ error: 'El porcentaje de recargo debe ser un número' })
      .min(0, 'El porcentaje de recargo no puede ser negativo')
      .max(100, 'El porcentaje de recargo no puede superar 100%')
      .default(0),
  })
  .superRefine((body, ctx) => {
    const claves = new Set();
    body.items.forEach((item, idx) => {
      const clave = `${item.id_producto}::${item.id_presentacion || 'unidad'}`;
      if (claves.has(clave)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', idx],
          message: 'Producto duplicado. Agrupe en un solo ítem con mayor cantidad.',
        });
      }
      claves.add(clave);
    });

    const series = new Set();
    body.items.forEach((item, idx) => {
      if (!item.numero_serie) return;
      if (series.has(item.numero_serie)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', idx, 'numero_serie'],
          message: `El número de serie "${item.numero_serie}" está repetido.`,
        });
      }
      series.add(item.numero_serie);
    });

    if (body.tipo_descuento_global === 'PORCENTAJE' && body.valor_descuento_global > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['valor_descuento_global'],
        message: 'El porcentaje de descuento no puede superar 100%.',
      });
    }

    if (body.facturar && (!body.cliente?.ci || body.cliente.ci === CI_CLIENTE_GENERICO)) {
      ctx.addIssue({
        code: 'custom',
        path: ['cliente', 'ci'],
        message: 'Para facturar debe enviar el CI/NIT del cliente.',
      });
    }

    if (!body.facturar && body.porcentaje_recargo_iva > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['porcentaje_recargo_iva'],
        message: 'El recargo por factura solo se aplica cuando la venta se factura.',
      });
    }
  });

export const crearVentaSchema = z.object({
  body: crearVentaBodySchema,
});

// ─── Listado ─────────────────────────────────────────────────────────────────
// Los query params vacíos (?metodo_pago=) se tratan como no enviados
const opcional = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

// 'YYYY-MM-DD' (contrato de filtros) o un ISO completo; ver inicioDelDia/finDelDia
const fechaFiltroSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'Fecha inválida, use el formato YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida');

export const listarVentasSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    search: opcional(z.string().trim().max(100)),
    id_cliente: opcional(idSchema('id_cliente')),
    id_empleado: opcional(idSchema('id_empleado')),
    metodo_pago: opcional(z.enum(METODOS_PAGO_VALIDOS, `Debe ser uno de: ${METODOS_PAGO_VALIDOS.join(', ')}`)),
    desde: opcional(fechaFiltroSchema),
    hasta: opcional(fechaFiltroSchema),
  }),
});
