import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { UNIDAD_MEDIDA_CONFIG } from '../../common/applyFilters.js';

export class UnidadMedidaRepository {
    constructor() {
        this.unidadMedidaModel = db.UnidadMedida;
    }

    async findById(id, { transaction } = {}) {
        return this.unidadMedidaModel.findByPk(id, { transaction });
    }

    async findAllPaginated(query = {}, { transaction } = {}) {
        const { where, limit, offset, order, page, perPage } =
            buildSequelizeQuery(query, UNIDAD_MEDIDA_CONFIG);

        const { rows, count } = await this.unidadMedidaModel.findAndCountAll({
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
            unidadMedidas: rows,
            total: count,
            page,
            perPage,
            totalPages: Math.ceil(count / perPage),
        };
    }

    async findAllFull({ transaction } = {}) {
        return this.unidadMedidaModel.findAll({
            where: { esta_activo: true },
            order: [['nombre', 'ASC']],
            transaction,
        });
    }

    async create(data, { transaction } = {}) {
        return this.unidadMedidaModel.create(data, { transaction });
    }

    async update(id, data, { transaction } = {}) {
        const [, [updated]] = await this.unidadMedidaModel.update(data, {
            where: { id },
            returning: true,
            transaction,
        });
        return updated ?? null;
    }

    async softDelete(id, { transaction } = {}) {
        return this.unidadMedidaModel.update(
            { esta_activo: false },
            { where: { id }, transaction }
        );
    }
}

export const unidadMedidaRepository = new UnidadMedidaRepository();
