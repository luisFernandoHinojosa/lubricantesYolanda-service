// src/modules/clientes/clientes.schema.js
import { z } from 'zod';

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

// ─── Schema base del cliente ─────────────────────────────────────────────────

const clienteBaseSchema = z.object({
  ci: z
    .string({ required_error: 'El CI es obligatorio' })
    .min(5, 'El CI debe tener al menos 5 caracteres')
    .max(20, 'El CI no puede superar 20 caracteres'),

  nombre: z
    .string({ required_error: 'El nombre es obligatorio' })
    .min(2, 'Mínimo 2 caracteres')
    .max(100, 'Máximo 100 caracteres'),

  apellido_paterno: z
    .string({ required_error: 'El apellido paterno es obligatorio' })
    .max(50, 'No puede superar 50 caracteres'),

  apellido_materno: z.string().max(50).optional(),

  correo_electronico: z
    .string()
    .email('Correo electrónico inválido')
    .max(100)
    .nullable()
    .optional(),

  fecha_nacimiento: z.preprocess(
    (v) => (typeof v === 'string' || v instanceof Date ? new Date(v) : v),
    z.date({
      required_error: 'La fecha de nacimiento es obligatoria',
      invalid_type_error: 'Debe ser una fecha válida',
    })
  ),

  telefono: nullableString(20),
  direccion: nullableString(1000),

  puntos: z
    .number({ invalid_type_error: 'Debe ser un número entero' })
    .int()
    .min(0, 'Los puntos no pueden ser negativos')
    .optional(),

  genero: nullableEnum(['M', 'F', 'O']),

  tipo_cliente: z
    .enum(['MAY', 'MIN'], {
      required_error: 'El tipo de cliente es obligatorio',
      invalid_type_error: 'Debe ser MAY o MIN',
    })
    .default('MIN'),
});

// ─── Schemas para cada operación ─────────────────────────────────────────────

export const createClienteSchema = z.object({
  body: clienteBaseSchema,
});

export const updateClienteSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: clienteBaseSchema.partial().strict(),
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


/** @typedef {import('zod').infer<typeof createClienteSchema>['body']} CreateClienteDTO */
/** @typedef {import('zod').infer<typeof updateClienteSchema>['body']} UpdateClienteDTO */
/** @typedef {import('zod').infer<typeof listClientesSchema>['query']} ListClientesQuery */