// src/modules/clientes/clientes.schema.js
import { z } from 'zod';
import {
  TIPO_DOCUMENTO_IDENTIDAD,
  TIPOS_DOCUMENTO_IDENTIDAD_VALIDOS,
  CORREO_CLIENTE_POR_DEFECTO,
} from '../../constants/business.constants.js';

// ─── Helpers reutilizables ───────────────────────────────────────────────────

const nullableString = (max) =>
  z.preprocess(
    (v) => (v === '' || v === 'undefined' || v == null ? null : v),
    z.string().max(max).nullable().optional()
  );

const nullableEnum = (values) =>
  z.preprocess(
    (v) => (v === '' || v === 'null' || v === 'undefined' || v == null ? null : v),
    z.enum(values).nullable().optional()
  );

// Correo al registrar un cliente: si no llega (o llega vacío) se asigna el correo por defecto.
// Solo se usa en los schemas de creación: en Zod 4, .partial() conserva los defaults y
// el update pisaría el correo del cliente.
const correoConDefault = z.preprocess(
  (v) => (v === '' || v === 'undefined' || v == null ? undefined : v),
  z.string().email('Correo electrónico inválido').max(100).default(CORREO_CLIENTE_POR_DEFECTO)
);

// Código SIAT: 1=CI, 2=CEX, 3=PAS, 4=OD, 5=NIT
const tipoDocumentoSchema = z.coerce
  .number({ invalid_type_error: 'Debe ser un número' })
  .int()
  .refine((v) => TIPOS_DOCUMENTO_IDENTIDAD_VALIDOS.includes(v), 'Tipo de documento inválido (1=CI, 2=CEX, 3=PAS, 4=OD, 5=NIT)');

const tipoClienteSchema = z.enum(['MAY', 'MIN'], {
  required_error: 'El tipo de cliente es obligatorio',
  invalid_type_error: 'Debe ser MAY o MIN',
});

// Los mismos campos sin default, para los schemas parciales: en Zod 4, .partial()
// conserva los defaults y el update reiniciaría el tipo de documento y de cliente.
const camposSinDefault = {
  tipo_documento: tipoDocumentoSchema,
  tipo_cliente: tipoClienteSchema,
};

// ─── Schema base del cliente ─────────────────────────────────────────────────

export const clienteBaseSchema = z.object({
  ci: z
    .string({ required_error: 'El CI o NIT es obligatorio' })
    .min(5, 'El CI o NIT debe tener al menos 5 caracteres')
    .max(20, 'El CI o NIT no puede superar 20 caracteres'),

  tipo_documento: tipoDocumentoSchema.default(TIPO_DOCUMENTO_IDENTIDAD.CI),

  complemento: nullableString(5),

  nombre: z
    .string({ required_error: 'El nombre es obligatorio' })
    .min(2, 'Mínimo 2 caracteres')
    .max(100, 'Máximo 100 caracteres'),

  apellido_paterno: nullableString(50),

  apellido_materno: nullableString(50),

  correo_electronico: z
    .string()
    .email('Correo electrónico inválido')
    .max(100)
    .nullable()
    .optional(),

  fecha_nacimiento: z.preprocess(
    (v) => (v === '' || v === 'undefined' || v == null ? null : (typeof v === 'string' || v instanceof Date ? new Date(v) : v)),
    z.date({
      invalid_type_error: 'Debe ser una fecha válida',
    })
      .nullable()
      .optional()
  ),

  telefono: z
    .string({ error: 'El teléfono es obligatorio' })
    .trim()
    .min(1, 'El teléfono es obligatorio')
    .max(20, 'El teléfono no puede superar 20 caracteres'),
  direccion: nullableString(1000),

  puntos: z
    .number({ invalid_type_error: 'Debe ser un número entero' })
    .int()
    .min(0, 'Los puntos no pueden ser negativos')
    .optional(),

  genero: nullableEnum(['M', 'F', 'O']),

  tipo_cliente: tipoClienteSchema.default('MIN'),
});

// ─── Schemas para cada operación ─────────────────────────────────────────────

export const createClienteSchema = z.object({
  body: clienteBaseSchema.extend({ correo_electronico: correoConDefault }),
});

export const updateClienteSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: clienteBaseSchema.extend(camposSinDefault).partial().strict(),
});

export const getClienteSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});

export const listClientesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['asc', 'desc']).default('desc'),
    sortBy: z.string().optional(),
    search: z.string().max(100).optional(),
    tipo_cliente: z.enum(['MAY', 'MIN']).optional(),
    esta_activo: z.coerce.boolean().optional(),
  }),
});

// ─── Schema del cliente al registrar o vincular en una venta ──────────────────
// En una venta solo el `ci` es estrictamente obligatorio para identificar al cliente.
// Si se envían otros campos (para registrarlo si no existe), se validan con las mismas
// reglas que clienteBaseSchema.
export const clienteVentaSchema = clienteBaseSchema.extend(camposSinDefault).partial().extend({
  ci: z
    .string({ required_error: 'El CI es obligatorio' })
    .min(5, 'El CI debe tener al menos 5 caracteres')
    .max(20, 'El CI no puede superar 20 caracteres'),
});

// ─── Schema para registrar un cliente nuevo desde una venta ──────────────────
// Se aplica solo cuando el CI enviado no existe: exige los campos obligatorios
// del modelo (ci, nombre, teléfono) y asigna el correo por defecto si no llega.
export const clienteNuevoVentaSchema = clienteBaseSchema.extend({
  correo_electronico: correoConDefault,
  nombre: z
    .string({ error: 'El nombre es obligatorio para registrar al cliente' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  telefono: z
    .string({ error: 'El teléfono es obligatorio para registrar al cliente' })
    .trim()
    .min(1, 'El teléfono es obligatorio para registrar al cliente')
    .max(20, 'El teléfono no puede superar 20 caracteres'),
});

/** @typedef {import('zod').infer<typeof createClienteSchema>['body']} CreateClienteDTO */
/** @typedef {import('zod').infer<typeof updateClienteSchema>['body']} UpdateClienteDTO */
/** @typedef {import('zod').infer<typeof listClientesSchema>['query']} ListClientesQuery */