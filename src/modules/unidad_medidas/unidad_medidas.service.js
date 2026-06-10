import { unidadMedidaRepository } from './unidad_medidas.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';

export class UnidadMedidaService {

  async getById(id) {
    const unidadMedida = await unidadMedidaRepository.findById(id);
    if (!unidadMedida) throw new NotFoundError(`Unidad de Medida con ID ${id}`);
    return unidadMedida;
  }

  async list(query) {
    return unidadMedidaRepository.findAllPaginated(query);
  }

  async listFull() {
    return unidadMedidaRepository.findAllFull();
  }

  async create(data) {
    return await sequelize.transaction(async (t) => {
      return unidadMedidaRepository.create(data, { transaction: t });
    });
  }

  async update(id, data) {
    await this.getById(id);
    
    const updated = await sequelize.transaction(async (t) => {
      return unidadMedidaRepository.update(id, data, { transaction: t });
    });
    
    if (!updated) throw new NotFoundError(`Unidad de Medida con ID ${id}`);
    
    return updated;
  }

  async remove(id) {
    await this.getById(id);
    
    await sequelize.transaction(async (t) => {
      await unidadMedidaRepository.softDelete(id, { transaction: t });
    });
  }
}

export const unidadMedidasService = new UnidadMedidaService();
