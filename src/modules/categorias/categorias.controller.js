import { categoriasService } from './categorias.service.js';

export class CategoriaController {

  list = async (req, res, next) => {
    try {
      const data = await categoriasService.list(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  listFull = async (req, res, next) => {
    try {
      const data = await categoriasService.listFull();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const categoria = req.categoria ?? await categoriasService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: categoria });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const categoria = await categoriasService.create(req.body);
      res.status(201).json({ status: 'success', data: categoria });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const categoria = await categoriasService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: categoria });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await categoriasService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export const categoriasController = new CategoriaController();
