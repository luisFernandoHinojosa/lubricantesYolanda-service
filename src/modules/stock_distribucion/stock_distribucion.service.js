import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { STOCK_DISTRIBUCION_CONFIG } from '../../common/applyFilters.js';

export const findAllStockDistribucion = async (query) => {
    const { where, limit, offset, order, page, perPage } = buildSequelizeQuery(query, STOCK_DISTRIBUCION_CONFIG);

    const { rows: stockDistribucion, count: total } = await db.StockDistribucion.findAndCountAll({
        where,
        include: [
            {
                model: db.Lote,
                as: 'lote',
                include: [{ model: db.Producto, as: 'producto', attributes: ['nombre_comercial'] }]
            },
            {
                model: db.Ubicacion,
                as: 'ubicacion',
                attributes: ['nombre', 'tipo_area'],
                include: [{ model: db.Sucursal, as: 'sucursal', attributes: ['nombre'] }]
            },
            {
                model: db.UbicacionFisica,
                as: 'ubicacion_fisica',
                attributes: ['nombre'],
                required: false
            }
        ],
        limit,
        offset,
        order,
    });

    return { stockDistribucion, total, page, perPage, totalPages: Math.ceil(total / perPage) };
};

export const findStockDistribucionById = async (id) => {
    return await db.StockDistribucion.findByPk(id, {
        include: [
            {
                model: db.Lote,
                as: 'lote',
                include: [{ model: db.Producto, as: 'producto', attributes: ['nombre_comercial'] }]
            },
            {
                model: db.Ubicacion,
                as: 'ubicacion',
                attributes: ['nombre', 'tipo_area'],
                include: [{ model: db.Sucursal, as: 'sucursal', attributes: ['nombre'] }]
            },
            {
                model: db.UbicacionFisica,
                as: 'ubicacion_fisica',
                attributes: ['nombre'],
                required: false
            }
        ]
    });
};

export const createStockDistribucion = async (stockData) => {
    return await db.StockDistribucion.create(stockData);
};

export const updateStockDistribucion = async (stock, stockData) => {
    return await stock.update(stockData);
};

export const deleteStockDistribucion = async (id) => {
    const stock = await db.StockDistribucion.findByPk(id);
    if (stock) {
        await stock.destroy();
    }
    return stock;
};

export const getTotalStockForProduct = async (id_producto) => {
    const result = await db.sequelize.query(`
        SELECT COALESCE(SUM(sd.cantidad_actual), 0) as total
        FROM "StockDistribucion" sd
        INNER JOIN "Lotes" l ON sd.id_lote = l.id
        WHERE l.id_producto = :id_producto
          AND sd.esta_activo = true
    `, {
        replacements: { id_producto },
        type: db.sequelize.QueryTypes.SELECT
    });
    return Number(result[0]?.total) || 0;
};

export const getStockPorUbicacionForProduct = async (id_producto) => {
    const resultado = await db.sequelize.query(`
        SELECT
            s.id as id_sucursal,
            s.nombre as sucursal,
            u.id as id_ubicacion,
            u.nombre as area,
            u.tipo_area,
            uf.id as id_ubicacion_fisica,
            uf.nombre as estante,
            COALESCE(SUM(sd.cantidad_actual), 0) as cantidad
        FROM "StockDistribucion" sd
        INNER JOIN "Lotes" l ON sd.id_lote = l.id
        LEFT JOIN "Ubicaciones" u ON sd.id_ubicacion = u.id
        LEFT JOIN "UbicacionesFisicas" uf ON sd.id_ubicacion_fisica = uf.id
        LEFT JOIN "Sucursales" s ON u.id_sucursal = s.id
        WHERE l.id_producto = :id_producto
          AND sd.esta_activo = true
          AND sd.cantidad_actual > 0
        GROUP BY s.id, s.nombre, u.id, u.nombre, u.tipo_area, uf.id, uf.nombre
        ORDER BY s.nombre, u.nombre, uf.nombre
    `, {
        replacements: { id_producto },
        type: db.sequelize.QueryTypes.SELECT
    });

    return resultado;
};

export const transferirStock = async (data, id_usuario) => {
    const {
        id_lote,
        id_ubicacion_origen,
        id_ubicacion_fisica_origen,
        id_ubicacion_destino,
        id_ubicacion_fisica_destino,
        cantidad,
        observacion
    } = data;
    console.log("data", data);

    if (
        id_ubicacion_origen === id_ubicacion_destino &&
        (id_ubicacion_fisica_origen ?? null) === (id_ubicacion_fisica_destino ?? null)
    ) {
        const err = new Error('La ubicación de origen y destino no pueden ser iguales.');
        err.statusCode = 400;
        throw err;
    }

    return await db.sequelize.transaction(async (t) => {
        const whereOrigen = {
            id_lote,
            id_ubicacion: id_ubicacion_origen,
            id_ubicacion_fisica: id_ubicacion_fisica_origen ?? null
        };

        const stockOrigen = await db.StockDistribucion.findOne({
            where: whereOrigen,
            transaction: t,
            lock: t.LOCK.UPDATE
        });

        if (!stockOrigen) {
            const err = new Error('No se encontró stock en la ubicación de origen para este lote.');
            err.statusCode = 404;
            throw err;
        }

        const qtyToTransfer = parseFloat(cantidad);

        if (parseFloat(stockOrigen.cantidad_actual) < qtyToTransfer) {
            const err = new Error(
                `Cantidad insuficiente (Actual: ${stockOrigen.cantidad_actual}, Solicitada: ${qtyToTransfer}).`
            );
            err.statusCode = 400;
            throw err;
        }

        // Descontar origen
        await stockOrigen.decrement('cantidad_actual', { by: qtyToTransfer, transaction: t });

        // Buscar o crear stock destino — sin increment duplicado
        const whereDestino = {
            id_lote,
            id_ubicacion: id_ubicacion_destino,
            id_ubicacion_fisica: id_ubicacion_fisica_destino ?? null
        };

        const stockDestino = await db.StockDistribucion.findOne({
            where: whereDestino,
            transaction: t,
            lock: t.LOCK.UPDATE
        });

        if (stockDestino) {
            await stockDestino.increment('cantidad_actual', { by: qtyToTransfer, transaction: t });
        } else {
            await db.StockDistribucion.create({
                ...whereDestino,
                cantidad_actual: qtyToTransfer,
                esta_activo: true
            }, { transaction: t });
        }

        // Kardex
        await db.KardexMovimiento.create({
            id_lote,
            tipo_movimiento: 'TRASLADO',
            cantidad: qtyToTransfer,
            id_ubicacion_origen,
            id_ubicacion_fisica_origen: id_ubicacion_fisica_origen ?? null,
            id_ubicacion_destino,
            id_ubicacion_fisica_destino: id_ubicacion_fisica_destino ?? null,
            id_usuario,
            observacion: observacion || 'Traslado de mercadería'
        }, { transaction: t });

        return { success: true };
    });
};

export const ajustarStock = async (stockDistribucion, data, id_usuario) => {
    const { cantidad, observacion } = data;
    const qtyAjuste = parseFloat(cantidad);

    return await db.sequelize.transaction(async (t) => {
        if (qtyAjuste < 0) {
            const decrementoAbsoluto = Math.abs(qtyAjuste);
            if (parseFloat(stockDistribucion.cantidad_actual) < decrementoAbsoluto) {
                const err = new Error(
                    `Stock insuficiente para realizar el ajuste negativo (Actual: ${stockDistribucion.cantidad_actual}, Ajuste: ${qtyAjuste}).`
                );
                err.statusCode = 400;
                throw err;
            }
            await stockDistribucion.decrement('cantidad_actual', { by: decrementoAbsoluto, transaction: t });
        } else {
            await stockDistribucion.increment('cantidad_actual', { by: qtyAjuste, transaction: t });
        }

        const tipo_movimiento = 'AJUSTE';

        await db.KardexMovimiento.create({
            id_lote: stockDistribucion.id_lote,
            tipo_movimiento,
            cantidad: Math.abs(qtyAjuste),
            id_ubicacion_origen: qtyAjuste < 0 ? stockDistribucion.id_ubicacion : null,
            id_ubicacion_fisica_origen: qtyAjuste < 0 ? stockDistribucion.id_ubicacion_fisica : null,
            id_ubicacion_destino: qtyAjuste > 0 ? stockDistribucion.id_ubicacion : null,
            id_ubicacion_fisica_destino: qtyAjuste > 0 ? stockDistribucion.id_ubicacion_fisica : null,
            id_usuario,
            observacion: observacion || `Ajuste manual de stock (${qtyAjuste > 0 ? '+' : ''}${qtyAjuste})`
        }, { transaction: t });

        return { success: true };
    });
};