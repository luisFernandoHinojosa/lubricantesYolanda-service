import { usuariosService } from './usuarios.service.js';
import { rolesService } from '../roles/roles.service.js';
import { NotFoundError, ConflictError } from '../../errors/AppError.js';

export const checkUsuarioExists = async (req, _res, next) => {
  try {
    const usuario = await usuariosService.getById(req.params.id);
    req.usuario = usuario;
    next();
  } catch (err) {
    next(err);
  }
};

export const existNameUserAndRol = async (req, res, next) => {
  try {
    const { name_user, rol_id } = req.body;
    
    if (rol_id) {
        await rolesService.getById(rol_id);
    }
    
    if (name_user) {
        const name_userExists = await usuariosService.getByName(name_user);
        if (name_userExists && name_userExists.id !== req.params?.id) {
            return next(new ConflictError(`El nombre de usuario '${name_user}' ya está en uso.`));
        }
    }
    next();
  } catch(err) {
      next(err);
  }
};

export const checkEmailIsAvailable = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (email) {
      const existingUser = await usuariosService.getByEmail(email);
      if (existingUser && existingUser.id !== req.params?.id) {
        return next(new ConflictError(`El email '${email}' ya está en uso.`));
      }
    }
    next();
  } catch(err) {
      next(err);
  }
};
