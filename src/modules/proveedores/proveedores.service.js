import { proveedorRepository } from './proveedores.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';

export class ProveedorService {

  async getById(id) {
    const proveedor = await proveedorRepository.findById(id);
    if (!proveedor) throw new NotFoundError(`Proveedor con ID ${id}`);
    return proveedor;
  }

  async list(query) {
    return proveedorRepository.findAllPaginated(query);
  }

  async listAll() {
    return proveedorRepository.findAll();
  }

  async listCatalogo() {
    return proveedorRepository.findAllCatalogo();
  }

  async listExtraData() {
    return proveedorRepository.findAllExtraData();
  }

  async create(data) {
    return await sequelize.transaction(async (t) => {
      return proveedorRepository.create(data, { transaction: t });
    });
  }

  async update(id, data) {
    await this.getById(id);

    const updated = await sequelize.transaction(async (t) => {
      return proveedorRepository.update(id, data, { transaction: t });
    });

    if (!updated) throw new NotFoundError(`Proveedor con ID ${id}`);

    return updated;
  }

  async remove(id) {
    await this.getById(id);

    await sequelize.transaction(async (t) => {
      await proveedorRepository.softDelete(id, { transaction: t });
    });
  }
}

export const proveedoresService = new ProveedorService();

// Exporting these specific functions for compatibility if they are imported individually elsewhere
export const findAllExtraDataProveedor = async () => {
  return await proveedoresService.listExtraData();
};