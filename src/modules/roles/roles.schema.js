import { z } from 'zod';

const roleBaseSchema = z.object({
  code_rol: z.string().min(2, 'El código del rol debe tener al menos 2 caracteres.'),
  nombre_rol: z.string().min(3, 'El nombre del rol debe tener al menos 3 caracteres.'),
  descripcion: z.string().optional(),
});

export const createRoleSchema = z.object({
  body: roleBaseSchema,
});

export const updateRoleSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: roleBaseSchema.partial().strict(),
});

export const getRoleSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});