import { ubicacionFisicaRepository } from './ubicaciones_fisicas.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';

export class UbicacionFisicaService {

  async getById(id) {
    const ubicacionFisica = await ubicacionFisicaRepository.findById(id);
    if (!ubicacionFisica) throw new NotFoundError(`Ubicación Física con ID ${id}`);
    return ubicacionFisica;
  }

  async list(query) {
    return ubicacionFisicaRepository.findAllPaginated(query);
  }

  async listFull() {
    return ubicacionFisicaRepository.findAllFull();
  }

  async listCatalogo() {
    return ubicacionFisicaRepository.findAllCatalogo();
  }

  async listByUbicacion(id_ubicacion) {
    return ubicacionFisicaRepository.findByUbicacion(id_ubicacion);
  }

  async create(data) {
    return await sequelize.transaction(async (t) => {
      return ubicacionFisicaRepository.create(data, { transaction: t });
    });
  }

  async update(id, data) {
    await this.getById(id);

    const updated = await sequelize.transaction(async (t) => {
      return ubicacionFisicaRepository.update(id, data, { transaction: t });
    });

    if (!updated) throw new NotFoundError(`Ubicación Física con ID ${id}`);

    return updated;
  }

  async remove(id) {
    await this.getById(id);

    await sequelize.transaction(async (t) => {
      await ubicacionFisicaRepository.softDelete(id, { transaction: t });
    });
  }
}

export const ubicacionesFisicasService = new UbicacionFisicaService();
