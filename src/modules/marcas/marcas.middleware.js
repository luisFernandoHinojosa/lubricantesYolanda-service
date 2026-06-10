import { marcasService } from './marcas.service.js';

export const checkMarcaExists = async (req, _res, next) => {
  try {
    const marca = await marcasService.getById(req.params.id);
    req.marca = marca;
    next();
  } catch (err) {
    next(err);
  }
};
