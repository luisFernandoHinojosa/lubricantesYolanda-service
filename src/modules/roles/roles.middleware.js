import { rolesService } from './roles.service.js';

export const checkRoleExists = async (req, _res, next) => {
  try {
    const role = await rolesService.getById(req.params.id);
    req.role = role;
    next();
  } catch (err) {
    next(err);
  }
};