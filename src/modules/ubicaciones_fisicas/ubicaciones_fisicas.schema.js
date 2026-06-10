import { z } from 'zod';

const ubicacionFisicaBaseSchema = z.object({
  id_ubicacion: z.string().uuid('ID de ubicación inválido'),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  descripcion: z.string().optional(),
  esta_activo: z.boolean().optional(),
});

export const createUbicacionFisicaSchema = z.object({
  body: ubicacionFisicaBaseSchema,
});

export const updateUbicacionFisicaSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: ubicacionFisicaBaseSchema.partial().strict(),
});

export const getUbicacionFisicaSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});

export const listUbicacionesFisicasSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC'),
    sortBy: z.string().optional(),
    search: z.string().optional(),
    id_ubicacion: z.string().uuid().optional(),
    esta_activo: z.coerce.boolean().optional(),
  }),
});

export const listByUbicacionSchema = z.object({
  params: z.object({ id_ubicacion: z.string().uuid('ID de ubicación inválido') }),
});
