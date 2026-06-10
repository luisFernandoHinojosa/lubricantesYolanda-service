import { clienteService } from './clientes.service.js';

export const checkClienteExists = async (req, _res, next) => {
  try {
    const cliente = await clienteService.getById(req.params.id);
    req.cliente = cliente;
    next();
  } catch (err) {
    next(err);
  }
};