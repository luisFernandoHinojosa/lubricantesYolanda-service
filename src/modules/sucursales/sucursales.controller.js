import { sucursalesService } from './sucursales.service.js';

export class SucursalController {

  list = async (req, res, next) => {
    try {
      const data = await sucursalesService.list(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  listFull = async (req, res, next) => {
    try {
      const data = await sucursalesService.listFull();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  listCatalogo = async (req, res, next) => {
    try {
      const data = await sucursalesService.listCatalogo();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const sucursal = req.sucursal ?? await sucursalesService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: sucursal });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const sucursal = await sucursalesService.create(req.body);
      res.status(201).json({ status: 'success', data: sucursal });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const sucursal = await sucursalesService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: sucursal });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await sucursalesService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export const sucursalesController = new SucursalController();
