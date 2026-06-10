import { ubicacionesService } from './ubicaciones.service.js';

export const checkUbicacionExists = async (req, _res, next) => {
  try {
    const ubicacion = await ubicacionesService.getById(req.params.id);
    req.ubicacion = ubicacion;
    next();
  } catch (err) {
    next(err);
  }
};
