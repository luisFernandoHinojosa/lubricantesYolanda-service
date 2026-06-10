import { empleadosService } from './empleados.service.js';

export const checkEmpleadoExists = async (req, _res, next) => {
  try {
    const empleado = await empleadosService.getById(req.params.id);
    req.empleado = empleado;
    next();
  } catch (err) {
    next(err);
  }
};
