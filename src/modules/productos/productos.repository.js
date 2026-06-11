import { Op, where } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { PRODUCTO_CONFIG } from '../../common/applyFilters.js';

export class ProductoRepository {
  constructor() {
    this.productoModel = db.Producto;
  }

  async findById(id, { transaction } = {}) {
    return this.productoModel.findByPk(id, { transaction });
  }

  async findAllPaginated(query = {}, { transaction } = {}) {
    const { where, limit, offset, order, page, perPage } = buildSequelizeQuery(query, PRODUCTO_CONFIG);

    const { rows: productosRaw, count: total } = await this.productoModel.findAndCountAll({
      where: {
        ...where,
        esta_activo: true,
      },
      include: [
        { model: db.Categoria, as: 'categoria', attributes: ['nombre'] },
        { model: db.Marca, as: 'marca', attributes: ['nombre'] },
        { model: db.UnidadMedida, as: 'unidad_medida', attributes: ['nombre', 'abreviatura'] },
        {
          model: db.Presentacion,
          as: 'presentaciones',
          attributes: ['id', 'nombre', 'codigo_barras', 'sku', 'factor_conversion', 'precio_especial', 'esta_activo'],
          include: [{ model: db.UnidadMedida, as: 'unidad_medida', attributes: ['nombre', 'abreviatura'] }],
          required: false,
        },
        {
          model: db.Lote,
          as: 'lotes',
          where: { esta_activo: true },
          required: false,
          include: [
            {
              model: db.Proveedor,
              as: 'proveedor',
              attributes: ['nombre']
            },
            {
              // where: { esta_activo: true, },
              model: db.StockDistribucion,
              as: 'stock_distribuciones',
              include: [{ model: db.Ubicacion, as: 'ubicacion', attributes: ['nombre', 'tipo_area'] }],
            },
          ],
        },
      ],
      limit,
      offset,
      order,
      distinct: true,
      subQuery: false,
      transaction,
    });

    return {
      productosRaw,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  async findAllProductsWithLotes() {
    return this.productoModel.findAll({
      attributes: ['id', 'imagen_url', 'nombre_comercial', 'codigo_barras', 'stock_minimo', 'precio_venta', 'esta_activo'],
      include: [
        { model: db.Categoria, as: 'categoria', attributes: ['nombre'] },
        { model: db.Marca, as: 'marca', attributes: ['nombre'] },
        {
          model: db.Lote,
          as: 'lotes',
          attributes: ['id', 'codigo_lote', 'costo_compra_unitario'],
          required: false,
          include: [
            {
              model: db.StockDistribucion,
              as: 'stock_distribuciones',
              attributes: ['cantidad_actual'],
              include: [{ model: db.Ubicacion, as: 'ubicacion', attributes: ['nombre'] }]
            }
          ]
        }
      ],
      order: [['nombre_comercial', 'ASC']]
    });
  }

  async findDetalleStockById(id_producto, { transaction } = {}) {
    return this.productoModel.findOne({
      where: {
        id: id_producto,
        esta_activo: true,
      },
      include: [
        {
          model: db.Categoria,
          as: 'categoria',
          attributes: ['nombre']
        },
        {
          model: db.Marca,
          as: 'marca',
          attributes: ['nombre']
        },
        {
          model: db.UnidadMedida,
          as: 'unidad_medida',
          attributes: ['nombre', 'abreviatura']
        },
        {
          model: db.Presentacion,
          as: 'presentaciones',
          attributes: ['id', 'nombre', 'codigo_barras', 'sku', 'factor_conversion', 'precio_especial', 'esta_activo'],
          include: [{ model: db.UnidadMedida, as: 'unidad_medida', attributes: ['nombre', 'abreviatura'] }],
          where: { esta_activo: true },
          required: false,
        },
        {
          model: db.Lote,
          as: 'lotes',
          required: false,
          where: {
            esta_activo: true,
          },
          include: [
            {
              model: db.Proveedor,
              as: 'proveedor',
              attributes: ['nombre']
            },
            {
              model: db.StockDistribucion,
              as: 'stock_distribuciones',
              required: false,
              include: [{ model: db.Ubicacion, as: 'ubicacion', attributes: ['nombre', 'tipo_area'] }],

            },
          ],
        },
      ],
      order: [[{ model: db.Lote, as: 'lotes' }, 'fecha_ingreso', 'DESC']],
      transaction,
    });
  }

  async create(data, { transaction }) {
    // console.log("precio venta sugerido", data.carga_inicial.precio_venta_sugerido)
    const producto = await this.productoModel.create({
      codigo_barras: data.codigo_barras || null,
      nombre_comercial: data.nombre_comercial,
      descripcion: data.descripcion || null,
      id_categoria: data.id_categoria,
      id_marca: data.id_marca,
      id_unidad_medida: data.id_unidad_medida,
      stock_minimo: data.stock_minimo ?? 0,
      precio_venta: data.carga_inicial?.precio_venta ?? 0,
      maneja_vencimiento: data.maneja_vencimiento ?? false,
      imagen_url: data.imagen_url ?? null,
      esta_activo: data.esta_activo ?? true,
    }, { transaction });

    // Crear presentaciones si vienen
    if (data.presentaciones && data.presentaciones.length > 0) {
      const presentacionesData = data.presentaciones.map((p) => ({
        id_producto: producto.id,
        id_unidad_medida: p.id_unidad_medida || null,
        nombre: p.nombre,
        factor_conversion: p.factor_conversion,
        precio_especial: p.precio_especial ?? 0,
        sku: p.sku || null,
        codigo_barras: p.codigo_barras || null,
        esta_activo: true,
      }));

      await db.Presentacion.bulkCreate(presentacionesData, { transaction });
    }

    return this.productoModel.findByPk(producto.id, {
      include: [
        {
          model: db.Categoria,
          as: 'categoria',
          attributes: ['nombre']
        },
        {
          model: db.Marca,
          as: 'marca',
          attributes: ['nombre']
        },
        {
          model: db.UnidadMedida,
          as: 'unidad_medida',
          attributes: ['nombre', 'abreviatura']
        },
        {
          model: db.Presentacion,
          as: 'presentaciones'
        },
      ],
      transaction,
    });
  }

  async update(id, data, { transaction } = {}) {
    const [, [updated]] = await this.productoModel.update(data, {
      where: { id },
      returning: true,
      transaction,
    });
    return updated ?? null;
  }

  async softDelete(id, { transaction } = {}) {
    return this.productoModel.update(
      { esta_activo: false },
      { where: { id }, transaction }
    );
  }

  async existsBarcode(barcode) {
    const inProductos = await this.productoModel.findOne({
      where: { codigo_barras: barcode },
      attributes: ['id'],
    });

    if (inProductos) return true;

    const inPresentaciones = await db.Presentacion.findOne({
      where: { codigo_barras: barcode },
      attributes: ['id'],
    });

    return !!inPresentaciones;
  }
}

export const productoRepository = new ProductoRepository();
