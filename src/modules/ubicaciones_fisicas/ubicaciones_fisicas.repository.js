import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { UBICACION_FISICA_CONFIG } from '../../common/applyFilters.js';

export class UbicacionFisicaRepository {
    constructor() {
        this.ubicacionFisicaModel = db.UbicacionFisica;
    }

    async findById(id, { transaction } = {}) {
        return this.ubicacionFisicaModel.findByPk(id, {
            include: [{ association: 'ubicacion', attributes: ['id', 'nombre', 'tipo_area'] }],
            transaction,
        });
    }

    async findAllPaginated(query = {}, { transaction } = {}) {
        const { where, limit, offset, order, page, perPage } =
            buildSequelizeQuery(query, UBICACION_FISICA_CONFIG);

        const { rows, count } = await this.ubicacionFisicaModel.findAndCountAll({
            where: {
                ...where,
                esta_activo: true,
            },
            include: [{ association: 'ubicacion', attributes: ['id', 'nombre', 'tipo_area'] }],
            limit,
            offset,
            order,
            transaction,
        });

        return {
            ubicaciones_fisicas: rows,
            total: count,
            page,
            perPage,
            totalPages: Math.ceil(count / perPage),
        };
    }

    async findAllFull({ transaction } = {}) {
        return this.ubicacionFisicaModel.findAll({
            where: { esta_activo: true },
            include: [{ association: 'ubicacion', attributes: ['id', 'nombre', 'tipo_area'] }],
            order: [['nombre', 'ASC']],
            transaction,
        });
    }

    async findAllCatalogo({ transaction } = {}) {
        return this.ubicacionFisicaModel.findAll({
            attributes: ['id', 'nombre', 'id_ubicacion'],
            where: { esta_activo: true },
            order: [['nombre', 'ASC']],
            transaction,
        });
    }

    async findByUbicacion(id_ubicacion, { transaction } = {}) {
        return this.ubicacionFisicaModel.findAll({
            where: { id_ubicacion, esta_activo: true },
            order: [['nombre', 'ASC']],
            transaction,
        });
    }

    async create(data, { transaction } = {}) {
        return this.ubicacionFisicaModel.create(data, { transaction });
    }

    async update(id, data, { transaction } = {}) {
        const [, [updated]] = await this.ubicacionFisicaModel.update(data, {
            where: { id },
            returning: true,
            transaction,
        });
        return updated ?? null;
    }

    async softDelete(id, { transaction } = {}) {
        return this.ubicacionFisicaModel.update(
            { esta_activo: false },
            { where: { id }, transaction }
        );
    }
}

export const ubicacionFisicaRepository = new UbicacionFisicaRepository();
