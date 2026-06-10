import { sucursalesService } from './sucursales.service.js';

export const checkSucursalExists = async (req, _res, next) => {
  try {
    const sucursal = await sucursalesService.getById(req.params.id);
    req.sucursal = sucursal;
    next();
  } catch (err) {
    next(err);
  }
};
