import { presentacionesService } from './presentaciones.service.js';

export class PresentacionController {

  list = async (req, res, next) => {
    try {
      const data = await presentacionesService.list(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const presentacion = req.presentacion ?? await presentacionesService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: presentacion });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const presentacion = await presentacionesService.create(req.body);
      res.status(201).json({ status: 'success', data: presentacion });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const presentacion = await presentacionesService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: presentacion });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await presentacionesService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export const presentacionesController = new PresentacionController();
