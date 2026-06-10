import { marcasService } from './marcas.service.js';

export class MarcaController {

  list = async (req, res, next) => {
    try {
      const data = await marcasService.list(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  listFull = async (req, res, next) => {
    try {
      const data = await marcasService.listFull();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const marca = req.marca ?? await marcasService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: marca });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const marca = await marcasService.create(req.body);
      res.status(201).json({ status: 'success', data: marca });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const marca = await marcasService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: marca });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await marcasService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export const marcasController = new MarcaController();
