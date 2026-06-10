import { clienteService } from './clientes.service.js';

export class ClienteController {

  list = async (req, res, next) => {
    try {
      const data = await clienteService.list(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const cliente = req.cliente ?? await clienteService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: cliente });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const cliente = await clienteService.create(req.body);
      res.status(201).json({ status: 'success', data: cliente });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const cliente = await clienteService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: cliente });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await clienteService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  getTop50 = async (_req, res, next) => {
    try {
      const data = await clienteService.getTop50ByPoints();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };
}

export const clienteController = new ClienteController();