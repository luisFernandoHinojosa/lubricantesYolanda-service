import { ubicacionesFisicasService } from './ubicaciones_fisicas.service.js';

export class UbicacionFisicaController {

  list = async (req, res, next) => {
    try {
      const data = await ubicacionesFisicasService.list(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  listFull = async (req, res, next) => {
    try {
      const data = await ubicacionesFisicasService.listFull();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  listCatalogo = async (req, res, next) => {
    try {
      const data = await ubicacionesFisicasService.listCatalogo();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  listByUbicacion = async (req, res, next) => {
    try {
      const data = await ubicacionesFisicasService.listByUbicacion(req.params.id_ubicacion);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const ubicacionFisica = req.ubicacionFisica ?? await ubicacionesFisicasService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: ubicacionFisica });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const ubicacionFisica = await ubicacionesFisicasService.create(req.body);
      res.status(201).json({ status: 'success', data: ubicacionFisica });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const ubicacionFisica = await ubicacionesFisicasService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: ubicacionFisica });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await ubicacionesFisicasService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export const ubicacionesFisicasController = new UbicacionFisicaController();
