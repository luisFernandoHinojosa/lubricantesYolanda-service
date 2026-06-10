import { loteRepository } from './lotes.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';

export class LoteService {

  async getById(id) {
    const lote = await loteRepository.findById(id);
    if (!lote) throw new NotFoundError(`Lote con ID ${id}`);
    return lote;
  }

  async getByProductoId(id_producto) {
    return loteRepository.findByProductoId(id_producto);
  }

  async list(query) {
    return loteRepository.findAllPaginated(query);
  }

  async findLotesDisponibles(id_producto) {
    return loteRepository.findLotesDisponibles(id_producto);
  }

  async create(data) {
    return await sequelize.transaction(async (t) => {
      return loteRepository.create(data, { transaction: t });
    });
  }

  async update(id, data) {
    await this.getById(id);

    const updated = await sequelize.transaction(async (t) => {
      return loteRepository.update(id, data, { transaction: t });
    });

    if (!updated) throw new NotFoundError(`Lote con ID ${id}`);

    return updated;
  }

  async remove(id) {
    await this.getById(id);

    await sequelize.transaction(async (t) => {
      await loteRepository.softDelete(id, { transaction: t });
    });
  }

  async restore(id) {
    await this.getById(id);

    await sequelize.transaction(async (t) => {
      await loteRepository.restore(id, { transaction: t });
    });
  }
}

export const lotesService = new LoteService();
