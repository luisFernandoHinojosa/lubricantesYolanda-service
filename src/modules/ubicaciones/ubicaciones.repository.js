import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { UBICACIONES_CONFIG } from '../../common/applyFilters.js';

export class UbicacionRepository {
    constructor() {
        this.ubicacionModel = db.Ubicacion;
    }

    async findById(id, { transaction } = {}) {
        return this.ubicacionModel.findByPk(id, { transaction });
    }

    async findAllPaginated(query = {}, { transaction } = {}) {
        const { where, limit, offset, order, page, perPage } =
            buildSequelizeQuery(query, UBICACIONES_CONFIG);

        const { rows, count } = await this.ubicacionModel.findAndCountAll({
            where: {
                ...where,
                esta_activo: true,
            },
            limit,
            offset,
            order,
            transaction,
        });

        return {
            ubicaciones: rows,
            total: count,
            page,
            perPage,
            totalPages: Math.ceil(count / perPage),
        };
    }

    async findAllFull({ transaction } = {}) {
        return this.ubicacionModel.findAll({
            where: { esta_activo: true },
            order: [['nombre', 'ASC']],
            transaction,
        });
    }

    async findAllCatalogo({ transaction } = {}) {
        return this.ubicacionModel.findAll({
            attributes: ['id', 'nombre', 'id_sucursal'],
            where: { esta_activo: true },
            order: [['nombre', 'ASC']],
            transaction,
        });
    }

    async create(data, { transaction } = {}) {
        return this.ubicacionModel.create(data, { transaction });
    }

    async update(id, data, { transaction } = {}) {
        const [, [updated]] = await this.ubicacionModel.update(data, {
            where: { id },
            returning: true,
            transaction,
        });
        return updated ?? null;
    }

    async softDelete(id, { transaction } = {}) {
        return this.ubicacionModel.update(
            { esta_activo: false },
            { where: { id }, transaction }
        );
    }
}

export const ubicacionRepository = new UbicacionRepository();
