import { categoriasService } from './categorias.service.js';

export const checkCategoriaExists = async (req, _res, next) => {
  try {
    const categoria = await categoriasService.getById(req.params.id);
    req.categoria = categoria;
    next();
  } catch (err) {
    next(err);
  }
};
