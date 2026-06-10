import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { CATEGORIA_CONFIG } from '../../common/applyFilters.js';

export class CategoriaRepository {
    constructor() {
        this.categoriaModel = db.Categoria;
    }

    async findById(id, { transaction } = {}) {
        return this.categoriaModel.findByPk(id, { transaction });
    }

    async findAllPaginated(query = {}, { transaction } = {}) {
        const { where, limit, offset, order, page, perPage } =
            buildSequelizeQuery(query, CATEGORIA_CONFIG);

        const { rows, count } = await this.categoriaModel.findAndCountAll({
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
            categorias: rows,
            total: count,
            page,
            perPage,
            totalPages: Math.ceil(count / perPage),
        };
    }

    async findAllFull({ transaction } = {}) {
        return this.categoriaModel.findAll({
            where: { esta_activo: true },
            order: [['nombre', 'ASC']],
            transaction,
        });
    }

    async create(data, { transaction } = {}) {
        return this.categoriaModel.create(data, { transaction });
    }

    async update(id, data, { transaction } = {}) {
        const [, [updated]] = await this.categoriaModel.update(data, {
            where: { id },
            returning: true,
            transaction,
        });
        return updated ?? null;
    }

    async softDelete(id, { transaction } = {}) {
        return this.categoriaModel.update(
            { esta_activo: false },
            { where: { id }, transaction }
        );
    }
}

export const categoriaRepository = new CategoriaRepository();
