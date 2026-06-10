import { presentacionesService } from './presentaciones.service.js';

export const checkPresentacionExists = async (req, _res, next) => {
  try {
    const presentacion = await presentacionesService.getById(req.params.id);
    req.presentacion = presentacion;
    next();
  } catch (err) {
    next(err);
  }
};
