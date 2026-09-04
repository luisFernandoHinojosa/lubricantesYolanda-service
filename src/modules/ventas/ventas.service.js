import { Op } from 'sequelize';
import db from '../../database/index.js';
import { VENTA_CONFIG } from '../../common/applyFilters.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';

const {
    Venta,
    DetalleVenta,
    PagoVenta,
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
    Devolucion,
    DetalleDevolucion,
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

const reingresarStock = async (id_producto, id_sucursal, unidades, transaction) => {
    const registro = await StockDistribucion.findOne({
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
        order: [[{ model: Lote, as: 'lote' }, 'fecha_ingreso', 'DESC']],
        transaction,
        lock: true,
    });

    if (!registro) {
        const err = new Error(`No se encontró un registro de stock para reingresar el producto.`);
        err.statusCode = 422;
        throw err;
    }

    await registro.increment('cantidad_actual', { by: unidades, transaction });

    return {
        id_lote: registro.id_lote,
        id_ubicacion: registro.id_ubicacion,
    };
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
    pagos, monto_pagado, notas,
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

        await PagoVenta.bulkCreate(
            pagos.map((p) => ({
                id_venta: venta.id,
                metodo_pago: p.metodo_pago,
                monto: parseFloat(p.monto).toFixed(2),
                referencia: p.referencia || null
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

export const anularVenta = async (id_venta, id_usuario) => {
    const empleado = await Empleado.findOne({ where: { usuario_id: id_usuario } });
    if (!empleado) {
        const err = new Error('El usuario no tiene un empleado asociado.');
        err.statusCode = 400;
        throw err;
    }
    const id_empleado = empleado.id;

    const venta = await Venta.findByPk(id_venta, {
        include: [
            { model: DetalleVenta, as: 'detalles' },
            { model: Cliente, as: 'cliente' },
        ],
    });

    if (!venta) {
        const err = new Error('Venta no encontrada.');
        err.statusCode = 404;
        throw err;
    }

    if (!venta.esta_activo) {
        const err = new Error('La venta ya se encuentra anulada.');
        err.statusCode = 400;
        throw err;
    }

    await sequelize.transaction(async (t) => {
        // 1. Desactivar venta
        await venta.update({ esta_activo: false }, { transaction: t });

        // 2. Reversar stock y kardex
        for (const detalle of venta.detalles) {
            const factor = parseFloat(detalle.factor_aplicado);
            const unidades_base = parseFloat(detalle.cantidad) * factor;

            const { id_lote, id_ubicacion } = await reingresarStock(
                detalle.id_producto,
                venta.id_sucursal,
                unidades_base,
                t
            );

            if (detalle.numero_serie) {
                await ProductoSerie.update(
                    { estado: 'DISPONIBLE' },
                    { where: { numero_serie: detalle.numero_serie }, transaction: t }
                );
            }

            await KardexMovimiento.create({
                id_lote,
                tipo_movimiento: 'ANULACION',
                cantidad: unidades_base,
                id_ubicacion_origen: null,
                id_ubicacion_destino: id_ubicacion,
                id_usuario,
                observacion: `Anulación de Venta ${venta.numero_comprobante}`,
            }, { transaction: t });
        }
    });

    // Descontar puntos de lealtad
    try {
        const cliente = venta.cliente;
        if (cliente && cliente.ci !== '000000') {
            const totalVenta = parseFloat(venta.total);
            const puntosADescontar = Math.floor(totalVenta / 50);

            if (puntosADescontar > 0) {
                const puntosActuales = parseInt(cliente.puntos || 0);
                const nuevosPuntos = Math.max(0, puntosActuales - puntosADescontar);
                await Cliente.update({ puntos: nuevosPuntos }, { where: { id: cliente.id } });
            }
        }
    } catch (e) {
        console.error('Error descontando puntos de lealtad al anular:', e.message);
    }

    return getVentaById(id_venta);
};

export const getVentaById = async (id) => {
    const v = await Venta.findByPk(id, {
        include: [
            {
                model: Cliente,
                as: 'cliente',
                attributes: ['id', 'nombre', 'ci', 'apellido_paterno', 'apellido_materno', 'telefono'],
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
            },
            {
                model: PagoVenta,
                as: 'pagos',
                attributes: ['id', 'metodo_pago', 'monto', 'referencia']
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
            {
                model: Devolucion,
                as: 'devoluciones',
                where: { estado: 'COMPLETADA', esta_activo: true },
                required: false,
                include: [
                    {
                        model: DetalleDevolucion,
                        as: 'detalles',
                        include: [
                            {
                                model: Producto,
                                as: 'producto_original',
                                attributes: ['id', 'nombre_comercial', 'codigo_barras'],
                                include: [{ model: UnidadMedida, as: 'unidad_medida', attributes: ['id', 'nombre', 'abreviatura'] }]
                            },
                            {
                                model: Producto,
                                as: 'producto_nuevo',
                                attributes: ['id', 'nombre_comercial', 'codigo_barras'],
                                include: [{ model: UnidadMedida, as: 'unidad_medida', attributes: ['id', 'nombre', 'abreviatura'] }]
                            },
                            { model: Presentacion, as: 'presentacion_original', attributes: ['id', 'nombre', 'factor_conversion'] },
                            { model: Presentacion, as: 'presentacion_nueva', attributes: ['id', 'nombre', 'factor_conversion'] }
                        ]
                    }
                ]
            }
        ],
    });

    if (!v) {
        const err = new Error('Venta no encontrada.');
        err.statusCode = 404;
        throw err;
    }

    const isCancelled = !v.esta_activo;

    let net = parseFloat(v.total);
    let retAmt = 0;
    let exchDiff = 0;

    // Mapear los detalles originales de la venta
    let detallesVenta = v.detalles.map(d => ({
        id: d.id,
        id_original: d.id,
        producto: d.producto,
        presentacion: d.presentacion,
        cantidad: parseFloat(d.cantidad),
        precio_unitario: parseFloat(d.precio_unitario),
        subtotal: parseFloat(d.subtotal),
        movimiento: 'VENTA',
        numero_serie: null
    }));

    if (!isCancelled && v.devoluciones) {
        v.devoluciones.forEach(dev => {
            if (dev.tipo === 'DEVOLUCION') {
                retAmt += parseFloat(dev.monto_devuelto);
                net -= parseFloat(dev.monto_devuelto);

                dev.detalles.forEach(dd => {
                    // Restar del original para no mostrar duplicados
                    const origIndex = detallesVenta.findIndex(d => d.id_original === dd.id_detalle_venta && d.movimiento === 'VENTA');
                    if (origIndex !== -1) {
                        detallesVenta[origIndex].cantidad -= parseFloat(dd.cantidad_devuelta);
                        detallesVenta[origIndex].subtotal -= parseFloat(dd.subtotal_devuelto);
                        if (detallesVenta[origIndex].cantidad <= 0) {
                            detallesVenta.splice(origIndex, 1);
                        }
                    }

                    detallesVenta.push({
                        id: dd.id + '-ret',
                        producto: dd.producto_original,
                        presentacion: dd.presentacion_original,
                        cantidad: parseFloat(dd.cantidad_devuelta),
                        precio_unitario: parseFloat(dd.precio_original),
                        subtotal: -parseFloat(dd.subtotal_devuelto),
                        movimiento: 'DEVOLUCION',
                        referencia_comprobante: dev.numero_devolucion
                    });
                });
            } else if (dev.tipo === 'CAMBIO') {
                exchDiff += parseFloat(dev.monto_diferencia);
                net += parseFloat(dev.monto_diferencia);

                dev.detalles.forEach(dd => {
                    // Restar del original para no mostrar duplicados
                    const origIndex = detallesVenta.findIndex(d => d.id_original === dd.id_detalle_venta && d.movimiento === 'VENTA');
                    if (origIndex !== -1) {
                        detallesVenta[origIndex].cantidad -= parseFloat(dd.cantidad_devuelta);
                        detallesVenta[origIndex].subtotal -= parseFloat(dd.subtotal_devuelto);
                        if (detallesVenta[origIndex].cantidad <= 0) {
                            detallesVenta.splice(origIndex, 1);
                        }
                    }

                    // Producto que entra (devuelto por el cliente)
                    detallesVenta.push({
                        id: dd.id + '-ret',
                        producto: dd.producto_original,
                        presentacion: dd.presentacion_original,
                        cantidad: parseFloat(dd.cantidad_devuelta),
                        precio_unitario: parseFloat(dd.precio_original),
                        subtotal: -parseFloat(dd.subtotal_devuelto),
                        movimiento: 'DEVOLUCION', // Marcado como DEVOLUCION porque el cliente lo devuelve
                        referencia_comprobante: dev.numero_devolucion,
                        notas: `Cambiado por: ${dd.producto_nuevo ? dd.producto_nuevo.nombre_comercial : 'Otro'}`
                    });

                    // Producto nuevo que se lleva el cliente
                    if (dd.id_producto_nuevo) {
                        detallesVenta.push({
                            id: dd.id + '-new',
                            producto: dd.producto_nuevo,
                            presentacion: dd.presentacion_nueva,
                            cantidad: parseFloat(dd.cantidad_nueva),
                            precio_unitario: parseFloat(dd.precio_nuevo),
                            subtotal: parseFloat(dd.subtotal_nuevo),
                            movimiento: 'CAMBIO',
                            referencia_comprobante: dev.numero_devolucion,
                            notas: `Entregado a cambio de: ${dd.producto_original.nombre_comercial}`
                        });
                    }
                });
            }
        });
    }

    return {
        id: v.id,
        numero_comprobante: v.numero_comprobante,
        id_sesion_caja: v.id_sesion_caja,
        subtotal: v.subtotal,
        tipo_descuento_global: v.tipo_descuento_global,
        valor_descuento_global: v.valor_descuento_global,
        monto_descuento_global: v.monto_descuento_global,
        total: net.toFixed(2), // Siempre mantener el total de la venta, incluso si fue anulada
        pagos: v.pagos,
        monto_pagado: v.monto_pagado,
        cambio_entregado: v.cambio_entregado,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
        cliente: v.cliente,
        cajero: v.cajero,
        sucursal: v.sucursal,
        esta_activo: v.esta_activo,
        // Nuevos atributos de coherencia
        monto_devuelto: retAmt.toFixed(2),
        diferencia_cambio: exchDiff.toFixed(2),
        total_neto: (isCancelled ? 0 : net).toFixed(2),
        // Array de detalles enriquecido
        detalles: detallesVenta
    };
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
        if (query.desde) {
            const desdeStr = (query.desde.includes('T') ? query.desde.split('T')[0] : query.desde).trim();
            where.createdAt[Op.gte] = `${desdeStr} 00:00:00`;
        }
        if (query.hasta) {
            const hastaStr = (query.hasta.includes('T') ? query.hasta.split('T')[0] : query.hasta).trim();
            where.createdAt[Op.lte] = `${hastaStr} 23:59:59.999`;
        }
    }

    const includes = [
        {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre', 'apellido_paterno', 'ci']
        },
        {
            model: PagoVenta,
            as: 'pagos',
            attributes: ['id', 'metodo_pago', 'monto', 'referencia']
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
        },
        {
            model: Devolucion,
            as: 'devoluciones',
            where: { estado: 'COMPLETADA', esta_activo: true },
            required: false
        }
    ];

    const [{ rows: ventasList, count: total }, allVentasForSum] = await Promise.all([
        Venta.findAndCountAll({
            where,
            limit,
            offset,
            order: order || [['createdAt', 'DESC']],
            subQuery: false,
            distinct: true,
            exclude: ['notas', 'id_sucursal', 'id_empleado', 'id_cliente'],
            include: includes
        }),
        Venta.findAll({
            where,
            attributes: ['id', 'total', 'esta_activo'],
            include: [
                ...includes.filter(i => i.as !== 'devoluciones').map(inc => ({ ...inc, attributes: [] })),
                {
                    model: Devolucion,
                    as: 'devoluciones',
                    where: { estado: 'COMPLETADA', esta_activo: true },
                    required: false,
                    attributes: ['tipo', 'monto_devuelto', 'monto_diferencia']
                }
            ]
        })
    ]);

    let totalMontoVentas = 0;
    allVentasForSum.forEach(v => {
        if (!v.esta_activo) return; // Si está anulada, el neto es 0

        let net = parseFloat(v.total);
        if (v.devoluciones) {
            v.devoluciones.forEach(dev => {
                if (dev.tipo === 'DEVOLUCION') net -= parseFloat(dev.monto_devuelto);
                else if (dev.tipo === 'CAMBIO') net += parseFloat(dev.monto_diferencia);
            });
        }
        totalMontoVentas += net;
    });

    const ventas = ventasList.map(v => {
        const isCancelled = !v.esta_activo;
        const status = isCancelled ? 'CANCELLED' : 'COMPLETED';

        let net = parseFloat(v.total);
        let retAmt = 0;
        let exchDiff = 0;

        if (!isCancelled && v.devoluciones) {
            v.devoluciones.forEach(dev => {
                if (dev.tipo === 'DEVOLUCION') {
                    retAmt += parseFloat(dev.monto_devuelto);
                    net -= parseFloat(dev.monto_devuelto);
                } else if (dev.tipo === 'CAMBIO') {
                    exchDiff += parseFloat(dev.monto_diferencia);
                    net += parseFloat(dev.monto_diferencia);
                }
            });
        }
        // mi observacion
        return {
            id: v.id,
            numero_comprobante: v.numero_comprobante,
            id_sesion_caja: v.id_sesion_caja,
            subtotal: v.subtotal,
            tipo_descuento_global: v.tipo_descuento_global,
            valor_descuento_global: v.valor_descuento_global,
            monto_descuento_global: v.monto_descuento_global,
            total: net.toFixed(2), // Siempre devuelve el total calculado, incluso si está anulado
            pagos: v.pagos,
            monto_pagado: v.monto_pagado,
            cambio_entregado: v.cambio_entregado,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
            cliente: v.cliente,
            cajero: v.cajero,
            sucursal: v.sucursal,
            esta_activo: v.esta_activo
        };
    });

    return {
        ventas,
        total,
        totalMontoVentas,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage)
    };
};

export const getResumenVentasSesion = async (id_sesion_caja) => {
    const ventas = await Venta.findAll({
        where: { id_sesion_caja },
        attributes: ['total', 'monto_descuento_global', 'esta_activo', 'cambio_entregado'],
        include: [{
            model: PagoVenta,
            as: 'pagos',
            attributes: ['metodo_pago', 'monto']
        }]
    });

    const resumen = {
        cantidad_ventas: 0,
        total_efectivo: 0, total_qr: 0, total_tarjeta: 0,
        total_descuentos: 0, gran_total: 0,
        cantidad_anuladas: 0,
        // Devoluciones y cambios
        cantidad_devoluciones: 0,
        cantidad_cambios: 0,
        total_reembolsado: 0,
        total_diferencias_cobradas: 0,
    };

    ventas.forEach((v) => {
        if (!v.esta_activo) {
            resumen.cantidad_anuladas++;
            return; // No sumar al total
        }
        resumen.cantidad_ventas++;
        const total = parseFloat(v.total);
        resumen.gran_total += total;
        resumen.total_descuentos += parseFloat(v.monto_descuento_global || 0);

        let efectivo = 0;
        let qr = 0;
        let tarjeta = 0;

        if (v.pagos) {
            v.pagos.forEach(p => {
                const monto = parseFloat(p.monto);
                if (p.metodo_pago === 'EFECTIVO') efectivo += monto;
                else if (p.metodo_pago === 'QR') qr += monto;
                else if (p.metodo_pago === 'TARJETA') tarjeta += monto;
            });
        }

        efectivo -= parseFloat(v.cambio_entregado || 0);

        resumen.total_efectivo += efectivo;
        resumen.total_qr += qr;
        resumen.total_tarjeta += tarjeta;
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