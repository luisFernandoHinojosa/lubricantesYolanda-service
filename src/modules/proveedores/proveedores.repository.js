import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { PROVEEDOR_CONFIG } from '../../common/applyFilters.js';
import { PROVEEDOR_EXCLUDED } from '../../common/attributeExclude.js';

export class ProveedorRepository {
    constructor() {
        this.proveedorModel = db.Proveedor;
    }

    async findById(id, { transaction } = {}) {
        return this.proveedorModel.findByPk(id, { transaction });
    }

    async findAllPaginated(query = {}, { transaction } = {}) {
        const { where, limit, offset, order, page, perPage } =
            buildSequelizeQuery(query, PROVEEDOR_CONFIG);

        const { rows, count } = await this.proveedorModel.findAndCountAll({
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
            proveedores: rows,
            total: count,
            page,
            perPage,
            totalPages: Math.ceil(count / perPage),
        };
    }

    async findAllCatalogo({ transaction } = {}) {
        return this.proveedorModel.findAll({
            attributes: ['id', 'nombre', 'empresa', 'nit_ci'],
            where: { esta_activo: true },
            order: [['nombre', 'ASC']],
            transaction,
        });
    }

    async findAllExtraData({ transaction } = {}) {
        return this.proveedorModel.findAll({
            attributes: {
                exclude: PROVEEDOR_EXCLUDED,
            },
            where: {
                esta_activo: true,
            },
            transaction,
        });
    }

    async findAll({ transaction } = {}) {
        return this.proveedorModel.findAll({ transaction });
    }

    async create(data, { transaction } = {}) {
        return this.proveedorModel.create(data, { transaction });
    }

    async update(id, data, { transaction } = {}) {
        const [, [updated]] = await this.proveedorModel.update(data, {
            where: { id },
            returning: true,
            transaction,
        });
        return updated ?? null;
    }

    async softDelete(id, { transaction } = {}) {
        return this.proveedorModel.update(
            { esta_activo: false },
            { where: { id }, transaction }
        );
    }
}

export const proveedorRepository = new ProveedorRepository();
