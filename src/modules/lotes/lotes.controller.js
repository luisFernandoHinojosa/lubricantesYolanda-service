import { lotesService } from './lotes.service.js';

export class LoteController {

  list = async (req, res, next) => {
    try {
      const data = await lotesService.list(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const lote = req.lote ?? await lotesService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: lote });
    } catch (err) {
      next(err);
    }
  };

  getByProductoId = async (req, res, next) => {
    try {
      const { id_producto } = req.params;
      const lotes = await lotesService.getByProductoId(id_producto);
      res.status(200).json({ status: 'success', data: lotes });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const lote = await lotesService.create(req.body);
      res.status(201).json({ status: 'success', data: lote });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const lote = await lotesService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: lote });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await lotesService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  restore = async (req, res, next) => {
    try {
      await lotesService.restore(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export const lotesController = new LoteController();
