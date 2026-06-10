import { proveedoresService } from './proveedores.service.js';

export const checkProveedorExists = async (req, _res, next) => {
  try {
    const proveedor = await proveedoresService.getById(req.params.id);
    req.proveedor = proveedor;
    next();
  } catch (err) {
    next(err);
  }
};
