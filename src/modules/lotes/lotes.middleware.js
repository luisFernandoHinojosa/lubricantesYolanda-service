import { lotesService } from './lotes.service.js';

export const checkLoteExists = async (req, _res, next) => {
  try {
    const lote = await lotesService.getById(req.params.id);
    req.lote = lote;
    next();
  } catch (err) {
    next(err);
  }
};
