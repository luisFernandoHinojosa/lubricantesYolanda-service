import { z } from 'zod';

const empleadoSchema = z.object({
  usuario_id: z.string().uuid('ID de usuario inválido.').optional().nullable(),
  ci: z.string().min(7, 'La cédula debe tener al menos 7 caracteres.'),
  fecha_nacimiento: z.coerce.date(),
  fecha_contratacion: z.coerce.date(),
  salario_base: z.number().positive('El salario base debe ser un número positivo.'),
  direccion: z.string().optional(),
  nombre: z.string().min(2, 'El nombre es requerido.'),
  apellido_paterno: z.string().min(2, 'El apellido es requerido.'),
  apellido_materno: z.string().optional(),
  cargo: z.string().optional(),
  telefono: z.string().optional(),

  usuario: z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
    name_user: z.string().min(3, 'Nombre de usuario requerido'),
    rol_id: z.string().uuid('Rol ID inválido'),
    id_sucursal: z.string().uuid('Sucursal ID inválida')
  }).optional()
});

export const createEmpleadoSchema = z.object({
  body: empleadoSchema,
});

const updateUsuarioSchema = z.object({
  email: z.string().email('Email inválido').optional(),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres').optional(),
  name_user: z.string().min(3, 'Nombre de usuario requerido').optional(),
  rol_id: z.string().uuid('Rol ID inválido').optional(),
  id_sucursal: z.string().uuid('Sucursal ID inválida').optional(),
  esta_activo: z.boolean().optional(),
}).optional();

export const updateEmpleadoSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: empleadoSchema.partial().extend({
    esta_activo: z.boolean().optional(),
    usuario: updateUsuarioSchema,
  }).strict(),
});

export const getEmpleadoSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});

export const listEmpleadosSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC'),
    sortBy: z.string().optional(),
    search: z.string().optional(),
    cargo: z.string().optional(),
    esta_activo: z.coerce.boolean().optional(),
  }),
});