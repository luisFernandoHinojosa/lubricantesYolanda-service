import { empleadosService } from './empleados.service.js';

export class EmpleadoController {

  list = async (req, res, next) => {
    try {
      const data = await empleadosService.list(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const empleado = req.empleado ?? await empleadosService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: empleado });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const empleado = await empleadosService.create(req.body);
      res.status(201).json({ status: 'success', data: empleado });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const empleado = await empleadosService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: empleado });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await empleadosService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export const empleadosController = new EmpleadoController();
