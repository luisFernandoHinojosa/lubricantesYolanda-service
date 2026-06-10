import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { PRODUCTOS_SERIES_CONFIG } from '../../common/applyFilters.js';

export class ProductoSerieRepository {
  constructor() {
    this.productoSerieModel = db.ProductoSerie;
  }

  async findById(id, { transaction } = {}) {
    return this.productoSerieModel.findByPk(id, {
      include: [
        { model: db.Lote, as: 'lote' },
        { model: db.Ubicacion, as: 'ubicacion' },
      ],
      transaction,
    });
  }

  async findBySerial(numero_serie, { transaction } = {}) {
    return this.productoSerieModel.findOne({
      where: { numero_serie },
      transaction,
    });
  }

  async findAllPaginated(query = {}, { transaction } = {}) {
    const { where, limit, offset, order, page, perPage } = buildSequelizeQuery(query, PRODUCTOS_SERIES_CONFIG);

    const { rows, count } = await this.productoSerieModel.findAndCountAll({
      where,
      include: [
        {
          model: db.Lote,
          as: 'lote',
          include: [{ model: db.Producto, as: 'producto' }],
        },
        { model: db.Ubicacion, as: 'ubicacion' },
      ],
      limit,
      offset,
      order,
      transaction,
    });

    return {
      productosSeries: rows,
      total: count,
      page,
      perPage,
      totalPages: Math.ceil(count / perPage),
    };
  }

  async create(data, { transaction } = {}) {
    return this.productoSerieModel.create(data, { transaction });
  }

  async update(id, data, { transaction } = {}) {
    const [, [updated]] = await this.productoSerieModel.update(data, {
      where: { id },
      returning: true,
      transaction,
    });
    return updated ?? null;
  }

  async remove(id, { transaction } = {}) {
    return this.productoSerieModel.destroy({
      where: { id },
      transaction,
    });
  }
}

export const productoSerieRepository = new ProductoSerieRepository();
