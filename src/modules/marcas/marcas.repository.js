import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { MARCA_CONFIG } from '../../common/applyFilters.js';

export class MarcaRepository {
    constructor() {
        this.marcaModel = db.Marca;
    }

    async findById(id, { transaction } = {}) {
        return this.marcaModel.findByPk(id, { transaction });
    }

    async findAllPaginated(query = {}, { transaction } = {}) {
        const { where, limit, offset, order, page, perPage } =
            buildSequelizeQuery(query, MARCA_CONFIG);

        const { rows, count } = await this.marcaModel.findAndCountAll({
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
            marcas: rows,
            total: count,
            page,
            perPage,
            totalPages: Math.ceil(count / perPage),
        };
    }

    async findAllFull({ transaction } = {}) {
        return this.marcaModel.findAll({
            where: { esta_activo: true },
            order: [['nombre', 'ASC']],
            transaction,
        });
    }

    async create(data, { transaction } = {}) {
        return this.marcaModel.create(data, { transaction });
    }

    async update(id, data, { transaction } = {}) {
        const [, [updated]] = await this.marcaModel.update(data, {
            where: { id },
            returning: true,
            transaction,
        });
        return updated ?? null;
    }

    async softDelete(id, { transaction } = {}) {
        return this.marcaModel.update(
            { esta_activo: false },
            { where: { id }, transaction }
        );
    }
}

export const marcaRepository = new MarcaRepository();
