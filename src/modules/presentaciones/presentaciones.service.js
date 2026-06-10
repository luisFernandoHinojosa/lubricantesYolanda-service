import { presentacionRepository } from './presentaciones.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';

export class PresentacionService {

  async getById(id) {
    const presentacion = await presentacionRepository.findById(id);
    if (!presentacion) throw new NotFoundError(`Presentacion con ID ${id}`);
    return presentacion;
  }

  async list(query) {
    return presentacionRepository.findAllPaginated(query);
  }

  async create(data) {
    return await sequelize.transaction(async (t) => {
      return presentacionRepository.create(data, { transaction: t });
    });
  }

  async update(id, data) {
    await this.getById(id);
    
    const updated = await sequelize.transaction(async (t) => {
      return presentacionRepository.update(id, data, { transaction: t });
    });
    
    if (!updated) throw new NotFoundError(`Presentacion con ID ${id}`);
    
    return updated;
  }

  async remove(id) {
    await this.getById(id);
    
    await sequelize.transaction(async (t) => {
      await presentacionRepository.softDelete(id, { transaction: t });
    });
  }
}

export const presentacionesService = new PresentacionService();
