import { unidadMedidasService } from './unidad_medidas.service.js';

export const checkUnidadMedidaExists = async (req, _res, next) => {
  try {
    const unidadMedida = await unidadMedidasService.getById(req.params.id);
    req.unidadMedida = unidadMedida;
    next();
  } catch (err) {
    next(err);
  }
};
