import { categoriaRepository } from './categorias.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';

export class CategoriaService {

  async getById(id) {
    const categoria = await categoriaRepository.findById(id);
    if (!categoria) throw new NotFoundError(`Categoría con ID ${id}`);
    return categoria;
  }

  async list(query) {
    return categoriaRepository.findAllPaginated(query);
  }

  async listFull() {
    return categoriaRepository.findAllFull();
  }

  async create(data) {
    return await sequelize.transaction(async (t) => {
      return categoriaRepository.create(data, { transaction: t });
    });
  }

  async update(id, data) {
    await this.getById(id);
    
    const updated = await sequelize.transaction(async (t) => {
      return categoriaRepository.update(id, data, { transaction: t });
    });
    
    if (!updated) throw new NotFoundError(`Categoría con ID ${id}`);
    
    return updated;
  }

  async remove(id) {
    await this.getById(id);
    
    await sequelize.transaction(async (t) => {
      await categoriaRepository.softDelete(id, { transaction: t });
    });
  }
}

export const categoriasService = new CategoriaService();
