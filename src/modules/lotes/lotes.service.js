import { loteRepository } from './lotes.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';
import db from '../../database/index.js';

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

  async create(data, id_usuario = null) {
    return await sequelize.transaction(async (t) => {
      if (!data.codigo_lote) {
        data.codigo_lote = `LOTE-${Date.now()}-${Math.floor(Math.random() * 100)}`;
      }

      const nuevoLote = await loteRepository.create(data, { transaction: t });

      const distribucionesValidas = (data.distribuciones || []).filter(
        (d) => (d.id_ubicacion || d.id_ubicacion_fisica) && Number(d.cantidad) > 0
      );

      if (distribucionesValidas.length > 0) {
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
            observacion: 'Ingreso de nuevo lote',
          }, { transaction: t });
        }
      }

      return nuevoLote;
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
