import { ubicacionesService } from './ubicaciones.service.js';

export class UbicacionController {

  list = async (req, res, next) => {
    try {
      const data = await ubicacionesService.list(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  listFull = async (req, res, next) => {
    try {
      const data = await ubicacionesService.listFull();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  listCatalogo = async (req, res, next) => {
    try {
      const data = await ubicacionesService.listCatalogo();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const ubicacion = req.ubicacion ?? await ubicacionesService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: ubicacion });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const ubicacion = await ubicacionesService.create(req.body);
      res.status(201).json({ status: 'success', data: ubicacion });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const ubicacion = await ubicacionesService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: ubicacion });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await ubicacionesService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export const ubicacionesController = new UbicacionController();
