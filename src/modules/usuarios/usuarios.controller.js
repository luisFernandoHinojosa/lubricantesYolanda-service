import { usuariosService } from './usuarios.service.js';

export class UsuarioController {

  listAll = async (req, res, next) => {
    try {
      const data = await usuariosService.listAll();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const usuario = req.usuario ?? await usuariosService.getById(req.params.id);
      
      if (usuario.dataValues) delete usuario.dataValues.password_hash;
      
      res.status(200).json({ status: 'success', data: usuario });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const usuario = await usuariosService.create(req.body);
      res.status(201).json({ status: 'success', data: usuario });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const usuario = await usuariosService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: usuario });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      await usuariosService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

export const usuariosController = new UsuarioController();
