import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { PRESENTACION_CONFIG } from '../../common/applyFilters.js';

export class PresentacionRepository {
    constructor() {
        this.presentacionModel = db.Presentacion;
    }

    async findById(id, { transaction } = {}) {
        return this.presentacionModel.findByPk(id, {
            include: [
                { model: db.Producto, as: 'producto' },
                { model: db.UnidadMedida, as: 'unidad_medida' }
            ],
            transaction
        });
    }

    async findAllPaginated(query = {}, { transaction } = {}) {
        const { where, limit, offset, order, page, perPage } =
            buildSequelizeQuery(query, PRESENTACION_CONFIG);

        const { rows, count } = await this.presentacionModel.findAndCountAll({
            where: {
                ...where,
                esta_activo: true,
            },
            include: [
                { model: db.Producto, as: 'producto', attributes: ['nombre_comercial'] },
                { model: db.UnidadMedida, as: 'unidad_medida', attributes: ['nombre', 'abreviatura'] }
            ],
            limit,
            offset,
            order,
            transaction,
        });

        return {
            presentaciones: rows,
            total: count,
            page,
            perPage,
            totalPages: Math.ceil(count / perPage),
        };
    }

    async create(data, { transaction } = {}) {
        return this.presentacionModel.create(data, { transaction });
    }

    async update(id, data, { transaction } = {}) {
        const [, [updated]] = await this.presentacionModel.update(data, {
            where: { id },
            returning: true,
            transaction,
        });
        return updated ?? null;
    }

    async softDelete(id, { transaction } = {}) {
        return this.presentacionModel.update(
            { esta_activo: false },
            { where: { id }, transaction }
        );
    }
}

export const presentacionRepository = new PresentacionRepository();
