import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { LOTE_CONFIG } from '../../common/applyFilters.js';

export class LoteRepository {
  constructor() {
    this.loteModel = db.Lote;
  }

  async findById(id, { transaction } = {}) {
    return this.loteModel.findByPk(id, {
      include: [
        { model: db.Producto, as: 'producto' },
        { model: db.Proveedor, as: 'proveedor' },
      ],
      transaction,
    });
  }

  async findByProductoId(id_producto, { transaction } = {}) {
    return this.loteModel.findAll({
      where: { id_producto },
      include: [
        { model: db.Producto, as: 'producto' },
        { model: db.Proveedor, as: 'proveedor' },
      ],
      order: [['fecha_ingreso', 'DESC']],
      transaction,
    });
  }

  async findAllPaginated(query = {}, { transaction } = {}) {
    const { where, limit, offset, order, page, perPage } = buildSequelizeQuery(query, LOTE_CONFIG);

    const { rows, count } = await this.loteModel.findAndCountAll({
      where,
      include: [
        { model: db.Producto, as: 'producto', attributes: ['nombre_comercial', 'codigo_barras'] },
        { model: db.Proveedor, as: 'proveedor', attributes: ['nombre', 'empresa'] },
      ],
      limit,
      offset,
      order,
      transaction,
    });

    return {
      lotes: rows,
      total: count,
      page,
      perPage,
      totalPages: Math.ceil(count / perPage),
    };
  }

  async create(data, { transaction } = {}) {
    return this.loteModel.create(data, { transaction });
  }

  async update(id, data, { transaction } = {}) {
    const [, [updated]] = await this.loteModel.update(data, {
      where: { id },
      returning: true,
      transaction,
    });
    return updated ?? null;
  }

  async remove(id, { transaction } = {}) {
    return this.loteModel.destroy({
      where: { id },
      transaction,
    });
  }

  async findUltimosLotesPorProducto(id_producto, limite = 5, { transaction } = {}) {
    return this.loteModel.findAll({
      where: { id_producto },
      order: [['fecha_ingreso', 'DESC']],
      limit: limite,
      attributes: [
        'id',
        'codigo_lote',
        'costo_compra_unitario',
        'fecha_ingreso'
      ],
      transaction
    });
  }

  async findLotesDisponibles(id_producto, { transaction } = {}) {
    const producto = await db.Producto.findByPk(id_producto);
    const manejaVencimiento = producto.maneja_vencimiento;
    return this.loteModel.findAll({
      where: { id_producto },
      include: [
        { model: db.Producto, as: 'producto' },
        { model: db.Proveedor, as: 'proveedor' },
      ],
      order: manejaVencimiento
        ? [['fecha_vencimiento', 'ASC']]
        : [['fecha_ingreso', 'ASC']],
      transaction,
    });
  }

  async softDelete(id, { transaction } = {}) {
    return this.loteModel.update(
      { esta_activo: false },
      { where: { id }, transaction }
    );
  }

  async restore(id, { transaction } = {}) {
    return this.loteModel.update(
      { esta_activo: true },
      { where: { id }, transaction }
    );
  }
}



export const loteRepository = new LoteRepository();
