import { proveedoresService } from './proveedores.service.js';

export class ProveedorController {

  list = async (req, res, next) => {
    try {
      const data = await proveedoresService.listAll();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  listFull = async (req, res, next) => {
    try {
      const data = await proveedoresService.list(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  listCatalogo = async (req, res, next) => {
    try {
      const data = await proveedoresService.listCatalogo();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const proveedor = req.proveedor ?? await proveedoresService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: proveedor });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const proveedor = await proveedoresService.create(req.body);
      res.status(201).json({ status: 'success', data: proveedor });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const proveedor = await proveedoresService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: proveedor });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await proveedoresService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export const proveedoresController = new ProveedorController();