import { sucursalRepository } from './sucursales.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';

export class SucursalService {

  async getById(id) {
    const sucursal = await sucursalRepository.findById(id);
    if (!sucursal) throw new NotFoundError(`Sucursal con ID ${id}`);
    return sucursal;
  }

  async list(query) {
    return sucursalRepository.findAllPaginated(query);
  }

  async listFull() {
    return sucursalRepository.findAllFull();
  }

  async listCatalogo() {
    return sucursalRepository.findAllCatalogo();
  }

  async create(data) {
    return await sequelize.transaction(async (t) => {
      return sucursalRepository.create(data, { transaction: t });
    });
  }

  async update(id, data) {
    await this.getById(id);

    const updated = await sequelize.transaction(async (t) => {
      return sucursalRepository.update(id, data, { transaction: t });
    });

    if (!updated) throw new NotFoundError(`Sucursal con ID ${id}`);

    return updated;
  }

  async remove(id) {
    await this.getById(id);

    await sequelize.transaction(async (t) => {
      await sucursalRepository.softDelete(id, { transaction: t });
    });
  }
}

export const sucursalesService = new SucursalService();
