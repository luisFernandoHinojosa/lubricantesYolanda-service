import { rolesService } from './roles.service.js';

export class RoleController {

  listAll = async (req, res, next) => {
    try {
      const data = await rolesService.listAll();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  list = async (req, res, next) => {
    try {
      const data = await rolesService.list(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  listCatalogo = async (req, res, next) => {
    try {
      const data = await rolesService.listCatalogo();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const role = req.role ?? await rolesService.getById(req.params.id);
      res.status(200).json({ status: 'success', data: role });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const role = await rolesService.create(req.body);
      res.status(201).json({ status: 'success', data: role });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const role = await rolesService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: role });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await rolesService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export const rolesController = new RoleController();