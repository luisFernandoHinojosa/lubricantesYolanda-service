import { productoRepository } from './productos.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';
import db from '../../database/index.js';
import { loteRepository } from '../lotes/lotes.repository.js';
import ExcelJS from 'exceljs';

export class ProductoService {

  async getById(id) {
    const producto = await productoRepository.findById(id);
    if (!producto) throw new NotFoundError(`Producto con ID ${id}`);
    return producto;
  }

  async list(query) {
    const data = await productoRepository.findAllPaginated(query);

    const productos = data.productosRaw.map(producto => {
      const prodJSON = producto.toJSON();

      let proveedor = null;
      let ubicacion = null;
      let stockTotalUnidadBase = 0;

      if (prodJSON.lotes && prodJSON.lotes.length > 0) {
        const loteConProveedor = prodJSON.lotes.find(l => l.proveedor);
        if (loteConProveedor) proveedor = loteConProveedor.proveedor;

        prodJSON.lotes.forEach(lote => {
          if (lote.stock_distribuciones) {
            lote.stock_distribuciones.forEach(dist => {
              stockTotalUnidadBase += parseFloat(dist.cantidad_actual || 0);

              if (!ubicacion && dist.ubicacion) {
                ubicacion = dist.ubicacion;
              }
            });
          }
        });
      }

      // delete prodJSON.lotes;

      return {
        ...prodJSON,
        lotes: prodJSON.lotes,
        stock_actual: stockTotalUnidadBase,
        proveedor,
        ubicacion,
      };
    });

    return {
      productos,
      total: data.total,
      page: data.page,
      perPage: data.perPage,
      totalPages: data.totalPages,
    };
  }

  async listWithLotesSimple() {
    const productos = await productoRepository.findAllProductsWithLotes();
    const result = [];

    productos.forEach(p => {
      const pData = p.toJSON ? p.toJSON() : p;

      const baseProductInfo = {
        Foto: pData.imagen_url,
        Nombre: pData.nombre_comercial,
        CodigoBarras: pData.codigo_barras,
        Categoria: pData.categoria ? pData.categoria.nombre : null,
        Marca: pData.marca ? pData.marca.nombre : null,
        StockMinimo: pData.stock_minimo,
        PrecioVenta: pData.precio_venta,
        Estado: pData.esta_activo
      };

      if (!pData.lotes || pData.lotes.length === 0) {
        result.push({
          ...baseProductInfo,
          StockActual: 0,
          Ubicacion: null,
          PrecioCompra: 0,
          codigo_lote: null
        });
      } else {
        pData.lotes.forEach(lote => {
          let stockActual = 0;
          let ubicaciones = [];

          if (lote.stock_distribuciones) {
            lote.stock_distribuciones.forEach(dist => {
              stockActual += parseFloat(dist.cantidad_actual || 0);
              if (dist.ubicacion && dist.ubicacion.nombre) {
                if (!ubicaciones.includes(dist.ubicacion.nombre)) {
                  ubicaciones.push(dist.ubicacion.nombre);
                }
              }
            });
          }

          result.push({
            ...baseProductInfo,
            StockActual: stockActual,
            Ubicacion: ubicaciones.length > 0 ? ubicaciones.join(', ') : null,
            PrecioCompra: lote.costo_compra_unitario,
            codigo_lote: lote.codigo_lote
          });
        });
      }
    });

    return result;
  }

  async exportarExcel() {
    const datos = await this.listWithLotesSimple();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventario de Lotes');

    worksheet.columns = [
      { header: 'Foto URL', key: 'Foto', width: 40 },
      { header: 'Nombre', key: 'Nombre', width: 30 },
      { header: 'Código de Barras', key: 'CodigoBarras', width: 20 },
      { header: 'Categoría', key: 'Categoria', width: 20 },
      { header: 'Marca', key: 'Marca', width: 20 },
      { header: 'Stock Mínimo', key: 'StockMinimo', width: 15 },
      { header: 'Precio Compra', key: 'PrecioCompra', width: 15 },
      { header: 'Precio Venta', key: 'PrecioVenta', width: 15 },
      { header: 'Stock Actual', key: 'StockActual', width: 15 },
      { header: 'Stock Mínimo', key: 'StockMinimo', width: 15 },
      { header: 'Estado', key: 'Estado', width: 10 },
      { header: 'Código Lote', key: 'codigo_lote', width: 20 },
      { header: 'Ubicación', key: 'Ubicacion', width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    datos.forEach((fila) => {
      worksheet.addRow({
        ...fila,
        Estado: fila.Estado ? 'Activo' : 'Inactivo',
      });
    });

    return await workbook.xlsx.writeBuffer();
  }

  async getHistorialCostos(id_producto) {
    const producto = await this.getById(id_producto);
    console.log("mi producto id", producto);
    const historial = await loteRepository.findUltimosLotesPorProducto(id_producto, 4);
    console.log('Historial encontrado en BD:', historial.length);
    return historial;
  }

  async getDetalleStockById(id) {
    const producto = await productoRepository.findDetalleStockById(id);
    if (!producto) throw new NotFoundError(`Producto con ID ${id}`);

    const prodJSON = producto.toJSON();
    let stockTotalGeneral = 0;

    const lotesValidos = prodJSON.lotes || [];

    const lotesConStock = lotesValidos.map(lote => {
      const distribuciones = lote.stock_distribuciones || [];
      const stockDelLote = distribuciones.reduce((acc, dist) => {
        return acc + parseFloat(dist.cantidad_actual || 0);
      }, 0);

      stockTotalGeneral += stockDelLote;

      return {
        ...lote,
        stock_lote_total: stockDelLote
      };
    });

    return {
      ...prodJSON,
      stock_actual_consolidado: stockTotalGeneral,
      lotes: lotesConStock
    };
  }

  async create(data, id_usuario = null) {
    return await sequelize.transaction(async (t) => {
      const nuevoProducto = await productoRepository.create(data, { transaction: t });
      // console.log(nuevoProducto);
      if (data.carga_inicial) {
        const { costo_unitario, fecha_vencimiento, distribuciones, id_proveedor } = data.carga_inicial;

        const distribucionesValidas = (distribuciones || []).filter(
          (d) => (d.id_ubicacion || d.id_ubicacion_fisica) && Number(d.cantidad) > 0
        );

        if (distribucionesValidas.length > 0) {
          const costUnitarioNum = Number(costo_unitario) || 0;
          const codigo_lote = `CI-${Date.now()}-${Math.floor(Math.random() * 100)}`;

          const nuevoLote = await db.Lote.create({
            id_producto: nuevoProducto.id,
            codigo_lote,
            costo_compra_unitario: costUnitarioNum,
            fecha_vencimiento: fecha_vencimiento || null,
            id_proveedor: id_proveedor || null,
          }, { transaction: t });

          for (const dist of distribucionesValidas) {
            const cantidad = Number(dist.cantidad);

            let id_ubicacion = dist.id_ubicacion || null;
            if (!id_ubicacion && dist.id_ubicacion_fisica) {
              const ubicFisica = await db.UbicacionFisica.findByPk(
                dist.id_ubicacion_fisica,
                { transaction: t }
              );
              id_ubicacion = ubicFisica?.id_ubicacion || null;
            }

            await db.StockDistribucion.create({
              id_lote: nuevoLote.id,
              id_ubicacion,
              id_ubicacion_fisica: dist.id_ubicacion_fisica || null,
              cantidad_actual: cantidad,
            }, { transaction: t });

            await db.KardexMovimiento.create({
              id_lote: nuevoLote.id,
              tipo_movimiento: 'INGRESO',
              cantidad,
              id_ubicacion_origen: null,
              id_ubicacion_destino: id_ubicacion,
              id_ubicacion_fisica_origen: null,
              id_ubicacion_fisica_destino: dist.id_ubicacion_fisica || null,
              id_usuario,
              observacion: 'Carga inicial al crear producto',
            }, { transaction: t });
          }
        }
      }

      return nuevoProducto;
    });
  }

  async update(id, data) {
    await this.getById(id);

    const updated = await sequelize.transaction(async (t) => {
      return productoRepository.update(id, data, { transaction: t });
    });

    if (!updated) throw new NotFoundError(`Producto con ID ${id}`);

    return updated;
  }

  async generateUniqueBarcode() {
    let barcode;
    let exists = true;
    let attempts = 0;
    const maxAttempts = 10;

    while (exists && attempts < maxAttempts) {
      // Generar un número de 13 dígitos
      // El primero entre 1 y 9
      const firstDigit = Math.floor(Math.random() * 9) + 1;
      const rest = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
      barcode = `${firstDigit}${rest}`;

      exists = await productoRepository.existsBarcode(barcode);
      attempts++;
    }

    if (exists) {
      throw new Error('No se pudo generar un código de barras único después de varios intentos.');
    }

    return barcode;
  }

  async remove(id) {
    await this.getById(id);

    await sequelize.transaction(async (t) => {
      await productoRepository.softDelete(id, { transaction: t });
    });
  }
}

export const productosService = new ProductoService();

// Export legacy functions just in case
export const findProductoById = async (id) => productosService.getById(id);
export const findAllProductos = async (query) => productosService.list(query);
export const findProductoDetalleStockById = async (id) => productosService.getDetalleStockById(id);
