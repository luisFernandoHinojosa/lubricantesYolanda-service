import { Op } from 'sequelize';
import db from '../../database/index.js';
import { VENTA_CONFIG } from '../../common/applyFilters.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';

const {
    Venta,
    DetalleVenta,
    SesionCaja,
    Producto,
    Presentacion,
    Cliente,
    Lote,
    StockDistribucion,
    Ubicacion,
    ProductoSerie,
    KardexMovimiento,
    sequelize,
    Empleado,
    Usuario,
    UnidadMedida,
    Sucursal,
} = db;

const generarNumeroComprobante = async (id_sucursal, transaction) => {
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefijo = `TK-${id_sucursal.slice(0, 4).toUpperCase()}-${fecha}`;
    const count = await Venta.count({
        where: { numero_comprobante: { [Op.like]: `${prefijo}%` }, id_sucursal },
        transaction,
    });
    return `${prefijo}-${String(count + 1).padStart(4, '0')}`;
};

const aplicarFIFO = async (registros, unidades, transaction) => {
    let restante = unidades;

    for (const registro of registros) {
        if (restante <= 0) break;
        const disponible = parseFloat(registro.cantidad_actual);
        const aDescontar = Math.min(disponible, restante);

        await registro.decrement('cantidad_actual', { by: aDescontar, transaction });

        restante -= aDescontar;
    }

    if (restante > 0) {
        const err = new Error('Stock insuficiente durante el descuento FIFO.');
        err.statusCode = 422;
        throw err;
    }
};

const getStockDisponible = async (id_producto, id_sucursal, transaction) => {
    const registros = await StockDistribucion.findAll({
        where: { cantidad_actual: { [Op.gt]: 0 } },
        include: [
            {
                model: Lote,
                as: 'lote',
                where: { id_producto },
                attributes: ['id', 'codigo_lote', 'fecha_ingreso'],
                required: true,
            },
            {
                model: Ubicacion,
                as: 'ubicacion',
                where: { id_sucursal },
                attributes: ['id', 'nombre'],
                required: true,
            },
        ],
        order: [[{ model: Lote, as: 'lote' }, 'fecha_ingreso', 'ASC']],
        transaction,
        lock: true,
    });

    const total = registros.reduce((acc, r) => acc + parseFloat(r.cantidad_actual), 0);
    return { total, registros };
};

const validarYEnriquecerItems = async (items, id_sucursal, transaction) => {
    const itemsEnriquecidos = [];

    for (const item of items) {
        const producto = await Producto.findByPk(item.id_producto, { transaction });
        if (!producto) {
            const err = new Error(`Producto ID "${item.id_producto}" no encontrado.`);
            err.statusCode = 404;
            throw err;
        }

        let factor_aplicado = 1;
        let precio_unitario;

        if (item.id_presentacion) {
            const presentacion = await Presentacion.findOne({
                where: { id: item.id_presentacion, id_producto: item.id_producto },
                transaction,
            });
            if (!presentacion) {
                const err = new Error(`Presentación inválida para "${producto.nombre_comercial}".`);
                err.statusCode = 404;
                throw err;
            }
            factor_aplicado = parseFloat(presentacion.factor_conversion);
            precio_unitario = parseFloat(presentacion.precio_especial);

        } else {
            if (producto.precio_venta === null || producto.precio_venta === undefined) {
                const err = new Error(`"${producto.nombre_comercial}" no tiene precio de venta general definido.`);
                err.statusCode = 422;
                throw err;
            }
            precio_unitario = parseFloat(producto.precio_venta);
        }

        let productoSerieRef = null;
        if (producto.maneja_serie) {
            if (!item.numero_serie?.trim()) {
                const err = new Error(`"${producto.nombre_comercial}" requiere número de serie.`);
                err.statusCode = 422;
                throw err;
            }
            productoSerieRef = await ProductoSerie.findOne({
                where: { numero_serie: item.numero_serie.trim(), estado: 'DISPONIBLE' },
                include: [{
                    model: Lote,
                    as: 'lote',
                    where: { id_producto: producto.id },
                    required: true,
                }],
                transaction,
                lock: true,
            });
            if (!productoSerieRef) {
                const err = new Error(
                    `Serie "${item.numero_serie}" no disponible para "${producto.nombre_comercial}".`
                );
                err.statusCode = 422;
                throw err;
            }
        }

        const unidades_base = parseFloat(item.cantidad) * factor_aplicado;
        const { total: stockDisponible, registros } = await getStockDisponible(
            item.id_producto,
            id_sucursal,
            transaction
        );

        if (stockDisponible < unidades_base) {
            const err = new Error(
                `Stock insuficiente para "${producto.nombre_comercial}". ` +
                `Disponible: ${stockDisponible.toFixed(2)}, requerido: ${unidades_base.toFixed(2)}.`
            );
            err.statusCode = 422;
            throw err;
        }

        const monto_descuento = parseFloat(item.monto_descuento || 0);
        const subtotal_item = Math.max(
            0,
            precio_unitario * parseFloat(item.cantidad) - monto_descuento
        );

        itemsEnriquecidos.push({
            id_producto: item.id_producto,
            id_presentacion: item.id_presentacion || null,
            cantidad: parseFloat(item.cantidad),
            factor_aplicado,
            precio_unitario,
            monto_descuento,
            subtotal: subtotal_item,
            numero_serie: item.numero_serie?.trim() || null,
            _registrosFIFO: registros,
            _unidades_base: unidades_base,
            _id_lote: registros[0]?.id_lote || null,
            _id_ubicacion: registros[0]?.id_ubicacion || null,
            _productoSerie: productoSerieRef,
        });
    }

    return itemsEnriquecidos;
};

export const crearVenta = async ({
    id_sucursal, id_sesion_caja, id_usuario, id_cliente,
    items, tipo_descuento_global, valor_descuento_global = 0,
    metodo_pago, monto_pagado, notas,
}) => {
    const empleado = await Empleado.findOne({ where: { usuario_id: id_usuario } });
    if (!empleado) {
        const err = new Error('El usuario no tiene un empleado asociado.');
        err.statusCode = 400;
        throw err;
    }
    const id_empleado = empleado.id;
    const sesion = await SesionCaja.findOne({
        where: { id: id_sesion_caja, id_sucursal, id_empleado, estado: 'ABIERTA' },
    });

    if (!sesion) {
        const err = new Error('No existe sesión de caja activa.');
        err.statusCode = 403;
        throw err;
    }

    let cliente = null;
    if (id_cliente) {
        cliente = await Cliente.findByPk(id_cliente);
    }

    if (!cliente) {
        cliente = await Cliente.findOne({ where: { ci: '000000' } });
        if (!cliente) {
            const err = new Error('Cliente no encontrado y el cliente genérico (CI: 000000) no existe.');
            err.statusCode = 404;
            throw err;
        }
        id_cliente = cliente.id;
    }

    const ventaCreada = await sequelize.transaction(async (t) => {

        const itemsEnriquecidos = await validarYEnriquecerItems(items, id_sucursal, t);
        const subtotal = itemsEnriquecidos.reduce((acc, i) => acc + i.subtotal, 0);

        let monto_descuento_global = 0;
        if (tipo_descuento_global === 'PORCENTAJE') {
            monto_descuento_global = (subtotal * parseFloat(valor_descuento_global)) / 100;
        } else if (tipo_descuento_global === 'FIJO') {
            monto_descuento_global = parseFloat(valor_descuento_global);
        }

        const total = Math.max(0, subtotal - monto_descuento_global);
        const cambio_entregado = parseFloat(monto_pagado) - total;

        if (cambio_entregado < 0) {
            const err = new Error('El monto pagado no cubre el total de la venta.');
            err.statusCode = 422;
            throw err;
        }

        const numero_comprobante = await generarNumeroComprobante(id_sucursal, t);

        const venta = await Venta.create({
            numero_comprobante,
            id_sucursal,
            id_sesion_caja,
            id_empleado,
            id_cliente,
            subtotal: subtotal.toFixed(2),
            tipo_descuento_global: tipo_descuento_global || null,
            valor_descuento_global,
            monto_descuento_global: monto_descuento_global.toFixed(2),
            total: total.toFixed(2),
            metodo_pago,
            monto_pagado: parseFloat(monto_pagado).toFixed(2),
            cambio_entregado: cambio_entregado.toFixed(2),
            notas: notas || null,
        }, { transaction: t });

        await DetalleVenta.bulkCreate(
            itemsEnriquecidos.map((item) => ({
                id_venta: venta.id,
                id_producto: item.id_producto,
                id_presentacion: item.id_presentacion,
                cantidad: item.cantidad,
                factor_aplicado: item.factor_aplicado,
                precio_unitario: item.precio_unitario,
                monto_descuento: item.monto_descuento,
                subtotal: item.subtotal,
                numero_serie: item.numero_serie,
            })),
            { transaction: t }
        );

        for (const item of itemsEnriquecidos) {
            await aplicarFIFO(item._registrosFIFO, item._unidades_base, t);

            if (item._productoSerie) {
                await item._productoSerie.update({ estado: 'VENDIDO' }, { transaction: t });
            }

            await KardexMovimiento.create({
                id_lote: item._id_lote,
                tipo_movimiento: 'VENTA',
                cantidad: item._unidades_base,
                id_ubicacion_origen: item._id_ubicacion,
                id_ubicacion_destino: null,
                id_usuario,
                observacion: `Venta ${numero_comprobante}`,
            }, { transaction: t });
        }

        return venta;
    });

    try {
        if (cliente && cliente.ci !== '000000') {
            const totalVenta = parseFloat(ventaCreada.total);
            const puntosGanados = Math.floor(totalVenta / 50);

            if (puntosGanados > 0) {
                await cliente.increment('puntos', { by: puntosGanados });
            }
        }
    } catch (e) {
        console.error('Error acumulando puntos de lealtad:', e.message);
    }

    return getVentaById(ventaCreada.id);
};

export const getVentaById = async (id) => {
    const venta = await Venta.findByPk(id, {
        include: [
            {
                model: Cliente,
                as: 'cliente',
                attributes: ['id', 'nombre', 'ci', 'apellido_paterno', 'apellido_materno', 'telefono'],
            },
            {
                model: DetalleVenta,
                as: 'detalles',
                include: [
                    {
                        model: Producto,
                        as: 'producto',
                        attributes: ['id', 'nombre_comercial', 'codigo_barras'],
                        include: [
                            {
                                model: UnidadMedida,
                                as: 'unidad_medida',
                                attributes: ['id', 'nombre', 'abreviatura'],
                            },
                        ],
                    },
                    {
                        model: Presentacion,
                        as: 'presentacion',
                        attributes: ['id', 'nombre', 'factor_conversion'],
                    },
                ],
            },
        ],
    });

    if (!venta) {
        const err = new Error('Venta no encontrada.');
        err.statusCode = 404;
        throw err;
    }

    return venta;
};

export const findAllVentas = async (query, userContext = {}) => {
    const filters = { ...query, ...userContext };
    const {
        where,
        limit,
        offset,
        order,
        page,
        perPage
    } = buildSequelizeQuery(filters, VENTA_CONFIG);

    if (query.desde || query.hasta) {
        where.createdAt = {};
        if (query.desde) where.createdAt[Op.gte] = new Date(query.desde);
        if (query.hasta) where.createdAt[Op.lte] = new Date(query.hasta);
    }

    const { rows: ventas, count: total } = await Venta.findAndCountAll({
        where,
        limit,
        offset,
        order: order || [['createdAt', 'DESC']],
        subQuery: false,
        distinct: true,
        exclude: ['notas', 'id_sucursal', 'id_empleado', 'id_cliente'],
        include: [
            {
                model: Cliente,
                as: 'cliente',
                attributes: ['id', 'nombre', 'apellido_paterno', 'ci']
            },
            {
                model: Sucursal,
                as: 'sucursal',
                attributes: ['id', 'nombre']
            },
            {
                model: Empleado,
                as: 'cajero',
                attributes: ['id', 'nombre', 'apellido_paterno', 'apellido_materno']
            }

        ]
    });

    return {
        ventas,
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage)
    };
};

export const getResumenVentasSesion = async (id_sesion_caja) => {
    const ventas = await Venta.findAll({
        where: { id_sesion_caja },
        attributes: ['metodo_pago', 'total', 'monto_descuento_global'],
    });

    const resumen = {
        cantidad_ventas: ventas.length,
        total_efectivo: 0, total_qr: 0, total_tarjeta: 0,
        total_descuentos: 0, gran_total: 0,
        // Devoluciones y cambios
        cantidad_devoluciones: 0,
        cantidad_cambios: 0,
        total_reembolsado: 0,
        total_diferencias_cobradas: 0,
    };

    ventas.forEach((v) => {
        const total = parseFloat(v.total);
        resumen.gran_total += total;
        resumen.total_descuentos += parseFloat(v.monto_descuento_global || 0);
        if (v.metodo_pago === 'EFECTIVO') resumen.total_efectivo += total;
        else if (v.metodo_pago === 'QR') resumen.total_qr += total;
        else if (v.metodo_pago === 'TARJETA') resumen.total_tarjeta += total;
    });

    // Incluir devoluciones/cambios de esta sesión
    try {
        const { Devolucion } = db;
        if (Devolucion) {
            const devoluciones = await Devolucion.findAll({
                where: { id_sesion_caja },
                attributes: ['tipo', 'monto_devuelto', 'monto_diferencia', 'metodo_reembolso'],
            });

            devoluciones.forEach((d) => {
                const devuelto = parseFloat(d.monto_devuelto);
                const diferencia = parseFloat(d.monto_diferencia);

                if (d.tipo === 'DEVOLUCION') {
                    resumen.cantidad_devoluciones++;
                    resumen.total_reembolsado += devuelto;
                } else {
                    resumen.cantidad_cambios++;
                    if (diferencia > 0) {
                        resumen.total_diferencias_cobradas += diferencia;
                    } else if (diferencia < 0) {
                        resumen.total_reembolsado += Math.abs(diferencia);
                    }
                }
            });
        }
    } catch (e) {
        console.error('Error obteniendo resumen de devoluciones:', e.message);
    }

    return resumen;
};