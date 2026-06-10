import { z } from 'zod';

const usuarioBaseSchema = z.object({
  rol_id: z.string().uuid('ID de rol inválido.'),
  id_sucursal: z.string().uuid('ID de sucursal inválido.').optional(),
  name_user: z.string().min(2, 'El nombre de usuario debe tener al menos 2 caracteres.'),
  email: z.string().email('El formato del email es inválido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  esta_activo: z.boolean().optional(),
});

export const createUsuarioSchema = z.object({
  body: usuarioBaseSchema,
});

export const updateUsuarioSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: usuarioBaseSchema.partial().strict(),
});

export const getUsuarioSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});