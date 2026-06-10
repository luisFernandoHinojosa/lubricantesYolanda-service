import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { CATEGORIA_MOVIMIENTO_CONFIG } from '../../common/applyFilters.js';
import { CATEGORIA_MOVIMIENTO_EXCLUDED } from '../../common/attributeExclude.js';

export const findAllCategoriasMovimientos = async (query) => {
    const {
        where,
        limit,
        offset,
        order,
        page,
        perPage
    } = buildSequelizeQuery(query, CATEGORIA_MOVIMIENTO_CONFIG);

    const { rows: categoriasMovimientos, count: total } = await db.CategoriaMovimiento.findAndCountAll({
        where: {
            ...where,
            esta_activo: true
        },
        limit,
        offset,
        order,
    });

    return {
        categoriasMovimientos,
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage)
    };
};

export const findAllCategoriasMovimientosFull = async (query = {}) => {
    const { tipo } = query;
    const where = { esta_activo: true };

    if (tipo) {
        where.tipo = tipo;
    }

    return await db.CategoriaMovimiento.findAll({
        where,
        attributes: {
            exclude: CATEGORIA_MOVIMIENTO_EXCLUDED
        },
        order: [
            ['nombre', 'ASC']
        ]
    });
};

export const findCategoriaMovimientoById = async (id) => {
    return await db.CategoriaMovimiento.findByPk(id);
};

export const createCategoriaMovimiento = async (data) => {
    return await db.CategoriaMovimiento.create(data);
};

export const updateCategoriaMovimiento = async (categoriaMovimiento, data) => {
    return await categoriaMovimiento.update(data);
};

export const deleteCategoriaMovimiento = async (id) => {
    const categoriaMovimiento = await db.CategoriaMovimiento.findByPk(id);
    if (categoriaMovimiento) {
        await categoriaMovimiento.destroy();
    }
    return categoriaMovimiento;
};
