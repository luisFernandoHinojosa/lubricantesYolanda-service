import { z } from 'zod';

const proveedorBaseSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  empresa: z.string().min(2, 'La empresa debe tener al menos 2 caracteres.'),
  apellido_paterno: z.string().optional(),
  apellido_materno: z.string().optional(),
  nit_ci: z.string().optional(),
  razon_social: z.string().optional(),
  contacto: z.string().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  esta_activo: z.boolean().optional(),
});

export const createProveedorSchema = z.object({
  body: proveedorBaseSchema,
});

export const updateProveedorSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: proveedorBaseSchema.partial().strict(),
});

export const getProveedorSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});

export const listProveedoresSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC'),
    sortBy: z.string().optional(),
    search: z.string().optional(),
    esta_activo: z.coerce.boolean().optional(),
  }),
});