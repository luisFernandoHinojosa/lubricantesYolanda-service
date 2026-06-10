import { z } from 'zod';

const productoBaseSchema = z.object({
    codigo_barras: z.string().optional().nullable(),
    nombre_comercial: z.string().min(2, 'El nombre comercial debe tener al menos 2 caracteres.'),
    id_categoria: z.string().uuid('ID de categoría inválido.'),
    id_marca: z.string().uuid('ID de marca inválido.'),
    id_unidad_medida: z.string().uuid('ID de unidad de medida inválido.'),
    precio_venta: z.coerce.number().nonnegative().default(0.00),
    precio_venta_sugerido: z.coerce.number().nonnegative().default(0.00),
    stock_minimo: z.coerce.number().int().nonnegative().default(0),
    maneja_vencimiento: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
    imagen_url: z.string().optional().nullable(),
    estado: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),
});

const presentacionItemSchema = z.object({
    nombre: z.string().min(2, 'El nombre de la presentación debe tener al menos 2 caracteres.'),
    factor_conversion: z.coerce.number().positive('El factor de conversión debe ser positivo.'),
    precio_especial: z.coerce.number().nonnegative('El precio especial no puede ser negativo.').optional().default(0),
});

const distribucionItemSchema = z.object({
    id_ubicacion: z.string().uuid().nullable().optional(),
    id_ubicacion_fisica: z.string().uuid().nullable().optional(),
    cantidad: z.coerce.number().positive(),
});

const cargaInicialSchema = z.object({
    costo_unitario: z.coerce.number().nonnegative().optional().default(0),
    precio_venta: z.coerce.number().nonnegative().optional().default(0),
    precio_venta_sugerido: z.coerce.number().nonnegative().optional().default(0),
    id_proveedor: z.string().uuid().nullable().optional(),
    fecha_vencimiento: z.string().nullable().optional(),
    distribuciones: z.array(distribucionItemSchema).min(1),
});

const presentacionesSchema = z.object({
    presentaciones: z.preprocess(
        (val) => (typeof val === 'string' ? JSON.parse(val) : val),
        z.array(presentacionItemSchema).optional().default([])
    ),
});

export const createProductoSchema = productoBaseSchema
    .merge(presentacionesSchema)
    .extend({
        carga_inicial: z.preprocess(
            (val) => (typeof val === 'string' ? JSON.parse(val) : val),
            cargaInicialSchema.optional()
        ),
    });

export const updateProductoSchema = productoBaseSchema.partial();