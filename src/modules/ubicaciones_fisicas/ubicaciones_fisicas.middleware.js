import { ubicacionesFisicasService } from './ubicaciones_fisicas.service.js';

export const checkUbicacionFisicaExists = async (req, _res, next) => {
  try {
    const ubicacionFisica = await ubicacionesFisicasService.getById(req.params.id);
    req.ubicacionFisica = ubicacionFisica;
    next();
  } catch (err) {
    next(err);
  }
};
