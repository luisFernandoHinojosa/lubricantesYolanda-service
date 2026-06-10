import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { SUCURSAL_CONFIG } from '../../common/applyFilters.js';

export class SucursalRepository {
    constructor() {
        this.sucursalModel = db.Sucursal;
    }

    async findById(id, { transaction } = {}) {
        return this.sucursalModel.findByPk(id, { transaction });
    }

    async findAllPaginated(query = {}, { transaction } = {}) {
        const { where, limit, offset, order, page, perPage } =
            buildSequelizeQuery(query, SUCURSAL_CONFIG);

        const { rows, count } = await this.sucursalModel.findAndCountAll({
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
            sucursales: rows,
            total: count,
            page,
            perPage,
            totalPages: Math.ceil(count / perPage),
        };
    }

    async findAllFull({ transaction } = {}) {
        return this.sucursalModel.findAll({
            where: { esta_activo: true },
            order: [['nombre', 'ASC']],
            transaction,
        });
    }

    findAllCatalogo({ transaction } = {}) {
        return this.sucursalModel.findAll({
            where: { esta_activo: true },
            order: [['nombre', 'ASC']],
            transaction,
        });
    }

    async create(data, { transaction } = {}) {
        return this.sucursalModel.create(data, { transaction });
    }

    async update(id, data, { transaction } = {}) {
        const [, [updated]] = await this.sucursalModel.update(data, {
            where: { id },
            returning: true,
            transaction,
        });
        return updated ?? null;
    }

    async softDelete(id, { transaction } = {}) {
        return this.sucursalModel.update(
            { esta_activo: false },
            { where: { id }, transaction }
        );
    }
}

export const sucursalRepository = new SucursalRepository();
