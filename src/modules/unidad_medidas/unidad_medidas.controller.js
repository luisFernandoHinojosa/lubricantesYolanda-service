import { unidadMedidasService } from './unidad_medidas.service.js';

export class UnidadMedidaController {

  list = async (req, res, next) => {
    try {
      const data = await unidadMedidasService.list(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  listFull = async (req, res, next) => {
    try {
      const data = await unidadMedidasService.listFull();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const unidadMedida = req.unidadMedida ?? await unidadMedidasService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: unidadMedida });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const unidadMedida = await unidadMedidasService.create(req.body);
      res.status(201).json({ status: 'success', data: unidadMedida });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const unidadMedida = await unidadMedidasService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: unidadMedida });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await unidadMedidasService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export const unidadMedidasController = new UnidadMedidaController();
