import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { COMPRA_CONFIG } from '../../common/applyFilters.js';

const {
    Compra,
    DetalleCompra,
    Producto,
    Lote,
    StockDistribucion,
    KardexMovimiento,
    Proveedor,
    Empleado,
    Sucursal,
    // Ubicacion,
    sequelize
} = db;

const generarNumeroComprobante = async (transaction) => {
    const count = await Compra.count({ transaction });
    return `COMP-${String(count + 1).padStart(6, '0')}`;
};

export const createCompra = async (data, id_usuario) => {
    // console.log(data);
    const { id_proveedor, id_sucursal, numero_comprobante, estado_pago, notas, detalles, id_ubicacion_destino } = data;

    // 1. Obtener el empleado que la registró
    const empleado = await Empleado.findOne({ where: { usuario_id: id_usuario } });
    if (!empleado) {
        const err = new Error('El usuario activo no tiene empleado asociado.');
        err.statusCode = 400;
        throw err;
    }

    if (!detalles || detalles.length === 0) {
        const err = new Error('La compra debe incluir al menos un producto.');
        err.statusCode = 400;
        throw err;
    }

    if (!id_ubicacion_destino) {
        const err = new Error('Se requiere especificar la ubicación destino de la sucursal.');
        err.statusCode = 400;
        throw err;
    }

    return await sequelize.transaction(async (t) => {
        let nro_comprobante = numero_comprobante;
        if (!nro_comprobante) {
            nro_comprobante = await generarNumeroComprobante(t);
        }

        let totalLiquidado = 0;
        detalles.forEach(d => {
            totalLiquidado += (parseFloat(d.cantidad) * parseFloat(d.costo_unitario));
        });

        // 2. Crear cabecera Compra
        const compra = await Compra.create({
            id_proveedor,
            id_empleado: empleado.id,
            id_sucursal,
            numero_comprobante: nro_comprobante,
            total: totalLiquidado,
            estado_pago: estado_pago || 'PAGADO',
            notas
        }, { transaction: t });

        // 3. Iterar por cada DetalleCompra
        for (const det of detalles) {
            const qty = parseFloat(det.cantidad);
            const cost = parseFloat(det.costo_unitario);
            const subtotal = qty * cost;

            // a. Crear el Lote
            const codigo_lote = `L-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const costNum = Number(cost);
            const nuevoLote = await Lote.create({
                id_producto: det.id_producto,
                id_proveedor: id_proveedor,
                codigo_lote: det.codigo_lote_provisto || codigo_lote, // si el usuario tipeó uno, úsalo, si no autogenera
                costo_compra_unitario: costNum,
                fecha_vencimiento: det.fecha_vencimiento_lote || null,
            }, { transaction: t });

            // b. Añadir el Detalle de Compra vinculando su lote
            await DetalleCompra.create({
                id_compra: compra.id,
                id_producto: det.id_producto,
                id_lote: nuevoLote.id,
                cantidad: qty,
                costo_unitario: cost,
                subtotal: subtotal,
                fecha_vencimiento_lote: det.fecha_vencimiento_lote || null,
            }, { transaction: t });

            // c. Crear el StockDistribucion
            await StockDistribucion.create({
                id_lote: nuevoLote.id,
                id_ubicacion: id_ubicacion_destino,
                cantidad_actual: qty,
            }, { transaction: t });

            // d. Generar el Kardex Movimiento
            await KardexMovimiento.create({
                id_lote: nuevoLote.id,
                tipo_movimiento: 'INGRESO',
                cantidad: qty,
                id_ubicacion_origen: null, // Viene de afuera
                id_ubicacion_destino: id_ubicacion_destino,
                id_usuario: id_usuario,
                observacion: `Ingreso por compra comprobante #${nro_comprobante}`
            }, { transaction: t });
        }

        return getCompraById(compra.id, t);
    });
};

export const getCompraById = async (id, transaction = null) => {
    const compra = await Compra.findByPk(id, {
        include: [
            { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre', 'razon_social', 'nit_ci'] },
            { model: Empleado, as: 'empleado', attributes: ['id', 'nombre', 'apellido_paterno'] },
            { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] },
            {
                model: DetalleCompra,
                as: 'detalles',
                include: [
                    { model: Producto, as: 'producto', attributes: ['id', 'nombre_comercial', 'codigo_barras', 'imagen_url'] },
                    { model: Lote, as: 'lote', attributes: ['id', 'codigo_lote'] }
                ]
            }
        ],
        transaction
    });

    if (!compra) {
        const err = new Error('Compra no encontrada');
        err.statusCode = 404;
        throw err;
    }

    return compra;
};

export const getAllCompras = async (query = {}) => {
    // COMPRA_CONFIG actual está más pensado en despachos/pollos
    // Haremos uno genérico rápido o usaremos el mismo si no está roto.
    // Usaremos pagination normal para evitar problemas:
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.perPage) || 15;
    const offset = (page - 1) * limit;

    let where = {};
    if (query.id_proveedor) where.id_proveedor = query.id_proveedor;
    if (query.estado_pago) where.estado_pago = query.estado_pago;
    if (query.id_sucursal) where.id_sucursal = query.id_sucursal;

    if (query.search) {
        where.numero_comprobante = { [Op.iLike]: `%${query.search}%` };
    }

    const { count, rows } = await Compra.findAndCountAll({
        where,
        limit,
        offset,
        order: [['fecha_compra', 'DESC']],
        include: [
            { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre', 'razon_social', 'nit_ci'] },
            { model: Empleado, as: 'empleado', attributes: ['id', 'nombre', 'apellido_paterno'] },
            { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] }
        ]
    });

    return {
        compras: rows,
        total: count,
        page,
        perPage: limit,
        totalPages: Math.ceil(count / limit)
    };
};

export const updateCompra = async (id, data) => {
    const { estado_pago, notas } = data;
    const compra = await Compra.findByPk(id);
    if (!compra) {
        const err = new Error('Compra no encontrada');
        err.statusCode = 404;
        throw err;
    }
    const updates = {};
    if (estado_pago !== undefined) updates.estado_pago = estado_pago;
    if (notas !== undefined) updates.notas = notas;
    await compra.update(updates);
    return getCompraById(id);
};

export const deleteCompra = async (id) => {
    const compra = await Compra.findByPk(id, {
        include: [{ model: DetalleCompra, as: 'detalles' }]
    });

    if (!compra) {
        const err = new Error('Compra no encontrada');
        err.statusCode = 404;
        throw err;
    }

    // Advertencia: esto no revierte el stock/kardex.
    // Si tu sistema lo requiere, aquí iría la lógica de rollback
    // (restar StockDistribucion y eliminar KardexMovimiento).
    await compra.destroy();
};