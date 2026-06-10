import { usuarioRepository } from './usuarios.repository.js';
import { NotFoundError, ConflictError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';
import bcrypt from 'bcrypt';

export class UsuarioService {

  async getById(id) {
    const usuario = await usuarioRepository.findById(id);
    if (!usuario) throw new NotFoundError(`Usuario con ID ${id}`);
    return usuario;
  }

  async getByName(name) {
    return usuarioRepository.findByName(name);
  }

  async getByEmail(email) {
    return usuarioRepository.findByEmail(email);
  }

  async listAll() {
    return usuarioRepository.findAll();
  }

  async create(data, options = {}) {
    const { password, ...restOfData } = data;

    // Validating directly in service just in case
    const nameExists = await this.getByName(restOfData.name_user);
    if (nameExists) throw new ConflictError(`El nombre de usuario '${restOfData.name_user}' ya está en uso.`);

    if (restOfData.email) {
      const emailExists = await this.getByEmail(restOfData.email);
      if (emailExists) throw new ConflictError(`El email '${restOfData.email}' ya está en uso.`);
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUsuario = await usuarioRepository.create({
      ...restOfData,
      password_hash: password_hash,
    }, options);

    if (newUsuario && newUsuario.dataValues) {
      delete newUsuario.dataValues.password_hash;
    }
    return newUsuario;
  }

  async update(id, data, { transaction } = {}) {
    await this.getById(id);

    // Hash password if updated
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.password_hash = await bcrypt.hash(data.password, salt);
      delete data.password;
    }

    let updated;
    if (transaction) {
      updated = await usuarioRepository.update(id, data, { transaction });
    } else {
      updated = await sequelize.transaction(async (t) => {
        return usuarioRepository.update(id, data, { transaction: t });
      });
    }

    if (!updated) throw new NotFoundError(`Usuario con ID ${id}`);

    if (updated.dataValues) {
      delete updated.dataValues.password_hash;
    }
    return updated;
  }

  async remove(id) {
    await this.getById(id);

    await sequelize.transaction(async (t) => {
      await usuarioRepository.remove(id, { transaction: t });
    });
  }

  async softDelete(id, { transaction } = {}) {
    return usuarioRepository.softDelete(id, { transaction });
  }

  async count() {
    return usuarioRepository.count();
  }

  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }
}

export const usuariosService = new UsuarioService();

// Support old functional signatures
export const findUsuarioByName = async (name) => usuariosService.getByName(name);
export const findUserByEmail = async (email) => usuariosService.getByEmail(email);
export const findUserById = async (id) => usuariosService.getById(id);
export const createUsuario = async (data, options) => usuariosService.create(data, options);