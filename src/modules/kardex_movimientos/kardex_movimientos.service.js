import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { KARDEX_MOVIMIENTO_CONFIG } from '../../common/applyFilters.js';

export const findAllKardexMovimientos = async (query) => {
    const {
        where,
        limit,
        offset,
        order,
        page,
        perPage
    } = buildSequelizeQuery(query, KARDEX_MOVIMIENTO_CONFIG);

    const { rows: kardexMovimientos, count: total } = await db.KardexMovimiento.findAndCountAll({
        where,
        include: [
            {
                model: db.Lote,
                as: 'lote',
                include: [{
                    model: db.Producto,
                    as: 'producto',
                    attributes: ['nombre_comercial']
                }]
            },
            {
                model: db.Ubicacion,
                as: 'ubicacion_origen',
                attributes: ['nombre']
            },
            {
                model: db.Ubicacion,
                as: 'ubicacion_destino',
                attributes: ['nombre']
            },
            {
                model: db.Usuario,
                as: 'usuario',
                attributes: ['id'],
                include: [
                    {
                        model: db.Empleado,
                        as: 'Empleado',
                        attributes: ['nombre', 'apellido_paterno', 'apellido_materno']
                    }
                ]
            }
        ],
        limit,
        offset,
        order,
    });

    return {
        kardexMovimientos,
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage)
    };
};

export const findKardexMovimientoById = async (id) => {
    return await db.KardexMovimiento.findByPk(id, {
        include: [
            { model: db.Lote, as: 'lote' },
            { model: db.Ubicacion, as: 'ubicacion_origen' },
            { model: db.Ubicacion, as: 'ubicacion_destino' },
            { model: db.Usuario, as: 'usuario' }
        ]
    });
};

export const createKardexMovimiento = async (movimientoData) => {
    return await db.KardexMovimiento.create(movimientoData);
};

export const updateKardexMovimiento = async (movimiento, movimientoData) => {
    return await movimiento.update(movimientoData);
};

export const deleteKardexMovimiento = async (id) => {
    const movimiento = await db.KardexMovimiento.findByPk(id);
    if (movimiento) {
        await movimiento.destroy();
    }
    return movimiento;
};
