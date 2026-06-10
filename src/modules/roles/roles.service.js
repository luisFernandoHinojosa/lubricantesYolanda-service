import { roleRepository } from './roles.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';

export class RoleService {

  async getById(id) {
    const role = await roleRepository.findById(id);
    if (!role) throw new NotFoundError(`Rol con ID ${id}`);
    return role;
  }

  async listAll() {
    return roleRepository.findAll();
  }

  async list(query) {
    return roleRepository.findAllPaginated(query);
  }

  async listCatalogo() {
    return roleRepository.findAllCatalogo();
  }

  async create(data) {
    return await sequelize.transaction(async (t) => {
      return roleRepository.create(data, { transaction: t });
    });
  }

  async update(id, data) {
    await this.getById(id);

    const updated = await sequelize.transaction(async (t) => {
      return roleRepository.update(id, data, { transaction: t });
    });

    if (!updated) throw new NotFoundError(`Rol con ID ${id}`);

    return updated;
  }

  async remove(id) {
    await this.getById(id);

    await sequelize.transaction(async (t) => {
      await roleRepository.remove(id, { transaction: t });
    });
  }
}

export const rolesService = new RoleService();