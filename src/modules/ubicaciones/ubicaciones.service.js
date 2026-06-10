import { ubicacionRepository } from './ubicaciones.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';

export class UbicacionService {

  async getById(id) {
    const ubicacion = await ubicacionRepository.findById(id);
    if (!ubicacion) throw new NotFoundError(`Ubicación con ID ${id}`);
    return ubicacion;
  }

  async list(query) {
    return ubicacionRepository.findAllPaginated(query);
  }

  async listFull() {
    return ubicacionRepository.findAllFull();
  }

  async listCatalogo() {
    return ubicacionRepository.findAllCatalogo();
  }

  async create(data) {
    return await sequelize.transaction(async (t) => {
      return ubicacionRepository.create(data, { transaction: t });
    });
  }

  async update(id, data) {
    await this.getById(id);
    
    const updated = await sequelize.transaction(async (t) => {
      return ubicacionRepository.update(id, data, { transaction: t });
    });
    
    if (!updated) throw new NotFoundError(`Ubicación con ID ${id}`);
    
    return updated;
  }

  async remove(id) {
    await this.getById(id);
    
    await sequelize.transaction(async (t) => {
      await ubicacionRepository.softDelete(id, { transaction: t });
    });
  }
}

export const ubicacionesService = new UbicacionService();
