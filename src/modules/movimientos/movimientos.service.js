import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { Op } from 'sequelize';

dayjs.extend(utc);
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { MOVIMIENTO_CONFIG } from '../../common/applyFilters.js';
import { MOVIMIENTO_EXCLUDED } from '../../common/attributeExclude.js';
import { findAllCategoriasMovimientosFull } from '../categorias_movimientos/categorias_movimientos.service.js';

export const findAllMovimientos = async (query) => {
    const {
        where,
        limit,
        offset,
        order,
        page,
        perPage
    } = buildSequelizeQuery(query, MOVIMIENTO_CONFIG);

    const { rows: movimientos, count: total } = await db.Movimiento.findAndCountAll({
        where: {
            ...where,
            esta_activo: true
        },
        limit,
        offset,
        order,
        include: [
            { model: db.CategoriaMovimiento, as: 'categoria_movimiento', attributes: ['id', 'nombre'] },
            { model: db.Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] },
            { model: db.Empleado, as: 'empleado', attributes: ['id', 'nombre', 'apellido_paterno'] }
        ]
    });

    const { tipo } = query;

    const extraData = {
        categoriasMovimientos: await findAllCategoriasMovimientosFull({ tipo })
    };

    return {
        movimientos,
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
        extraData
    };
};

export const findMovimientoById = async (id) => {
    return await db.Movimiento.findByPk(id, {
        include: [
            { model: db.CategoriaMovimiento, as: 'categoria_movimiento' },
            { model: db.Sucursal, as: 'sucursal' },
            { model: db.Empleado, as: 'empleado' }
        ]
    });
};

export const createMovimiento = async (data) => {
    return await db.Movimiento.create(data);
};

export const updateMovimiento = async (movimiento, data) => {
    return await movimiento.update(data);
};

export const deleteMovimiento = async (id) => {
    const movimiento = await db.Movimiento.findByPk(id);
    if (movimiento) {
        await movimiento.destroy();
    }
    return movimiento;
};

export const findMovimientosByDateRange = async (params) => {
    const { startDate, endDate, page, perPage, search } = params;
    const offset = (page - 1) * perPage;

    // Use UTC to avoid timezone shifts and cover the full day
    const start = dayjs.utc(startDate).startOf('day').toDate();
    const end = dayjs.utc(endDate).endOf('day').toDate();

    const where = {
        esta_activo: true,
        fecha: {
            [Op.between]: [start, end]
        }
    };

    if (search) {
        where[Op.or] = [
            { nombre: { [Op.iLike]: `%${search}%` } },
            { descripcion: { [Op.iLike]: `%${search}%` } }
        ];
    }

    // 1. Paginated results
    const { rows: movimientos, count: total } = await db.Movimiento.findAndCountAll({
        where,
        limit: perPage,
        offset,
        order: [['fecha', 'DESC']],
        include: [
            { model: db.CategoriaMovimiento, as: 'categoria_movimiento', attributes: ['id', 'nombre', 'tipo'] },
            { model: db.Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] },
            { model: db.Empleado, as: 'empleado', attributes: ['id', 'nombre', 'apellido_paterno'] }
        ]
    });

    // 2. Aggregations for the whole range (Optimized: single query for both totals)
    const stats = await db.Movimiento.findAll({
        where,
        attributes: [
            'tipo',
            [db.sequelize.fn('SUM', db.sequelize.col('monto')), 'total_monto'],
            [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'cantidad']
        ],
        group: ['tipo']
    });

    // Parse stats
    const results = {
        INGRESO: { monto: 0, cantidad: 0 },
        EGRESO: { monto: 0, cantidad: 0 }
    };

    stats.forEach(s => {
        const tipo = s.tipo;
        results[tipo] = {
            monto: parseFloat(s.get('total_monto')) || 0,
            cantidad: parseInt(s.get('cantidad')) || 0
        };
    });

    return {
        movimientos,
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
        estadisticas: {
            totalIngresos: results.INGRESO.monto,
            totalEgresos: results.EGRESO.monto,
            balance: results.INGRESO.monto - results.EGRESO.monto,
            cantidadIngresos: results.INGRESO.cantidad,
            cantidadEgresos: results.EGRESO.cantidad,
            totalMovimientos: results.INGRESO.cantidad + results.EGRESO.cantidad
        }
    };
};
