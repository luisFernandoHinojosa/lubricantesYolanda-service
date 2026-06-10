import { marcaRepository } from './marcas.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';

export class MarcaService {

  async getById(id) {
    const marca = await marcaRepository.findById(id);
    if (!marca) throw new NotFoundError(`Marca con ID ${id}`);
    return marca;
  }

  async list(query) {
    return marcaRepository.findAllPaginated(query);
  }

  async listFull() {
    return marcaRepository.findAllFull();
  }

  async create(data) {
    return await sequelize.transaction(async (t) => {
      return marcaRepository.create(data, { transaction: t });
    });
  }

  async update(id, data) {
    await this.getById(id);
    
    const updated = await sequelize.transaction(async (t) => {
      return marcaRepository.update(id, data, { transaction: t });
    });
    
    if (!updated) throw new NotFoundError(`Marca con ID ${id}`);
    
    return updated;
  }

  async remove(id) {
    await this.getById(id);
    
    await sequelize.transaction(async (t) => {
      await marcaRepository.softDelete(id, { transaction: t });
    });
  }
}

export const marcasService = new MarcaService();
