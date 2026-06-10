import { productosSeriesService } from './productos_series.service.js';

export class ProductoSerieController {

  list = async (req, res, next) => {
    try {
      const data = await productosSeriesService.list(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const serie = req.productoSerie ?? await productosSeriesService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: serie });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const serie = await productosSeriesService.create(req.body);
      res.status(201).json({ status: 'success', data: serie });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const serie = await productosSeriesService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: serie });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await productosSeriesService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export const productosSeriesController = new ProductoSerieController();
