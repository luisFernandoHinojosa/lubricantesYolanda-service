import { productoSerieRepository } from './productos_series.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';

export class ProductoSerieService {

  async getById(id) {
    const serie = await productoSerieRepository.findById(id);
    if (!serie) throw new NotFoundError(`ProductoSerie con ID ${id}`);
    return serie;
  }

  async getBySerial(numero_serie) {
    return productoSerieRepository.findBySerial(numero_serie);
  }

  async list(query) {
    return productoSerieRepository.findAllPaginated(query);
  }

  async create(data) {
    return await sequelize.transaction(async (t) => {
      return productoSerieRepository.create(data, { transaction: t });
    });
  }

  async update(id, data) {
    await this.getById(id);
    
    const updated = await sequelize.transaction(async (t) => {
      return productoSerieRepository.update(id, data, { transaction: t });
    });
    
    if (!updated) throw new NotFoundError(`ProductoSerie con ID ${id}`);
    
    return updated;
  }

  async remove(id) {
    await this.getById(id);
    
    await sequelize.transaction(async (t) => {
      await productoSerieRepository.remove(id, { transaction: t });
    });
  }
}

export const productosSeriesService = new ProductoSerieService();

// Export function for legacy compatibility
export const findBySerial = async (numero_serie) => productosSeriesService.getBySerial(numero_serie);
