import { Op } from 'sequelize';
import db from '../../database/index.js';
import { DEVOLUCION_CONFIG } from '../../common/applyFilters.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';

const {
    Devolucion,
    DetalleDevolucion,
    DetalleVenta,
    Venta,
    Producto,
    Presentacion,
    Lote,
    StockDistribucion,
    Ubicacion,
    ProductoSerie,
    KardexMovimiento,
    SesionCaja,
    Empleado,
    Cliente,
    Sucursal,
    sequelize,
} = db;

// ─────────────────────────────────────────────────────────────────────────────
// Generar número de comprobante para devoluciones
// ─────────────────────────────────────────────────────────────────────────────
const generarNumeroDevolucion = async (id_sucursal, transaction) => {
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefijo = `DEV-${id_sucursal.slice(0, 4).toUpperCase()}-${fecha}`;
    const count = await Devolucion.count({
        where: { numero_devolucion: { [Op.like]: `${prefijo}%` }, id_sucursal },
        transaction,
    });
    return `${prefijo}-${String(count + 1).padStart(4, '0')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Obtener la cantidad ya devuelta previamente para un detalle de venta
// ─────────────────────────────────────────────────────────────────────────────
const getCantidadYaDevuelta = async (id_detalle_venta, transaction) => {
    const result = await DetalleDevolucion.sum('cantidad_devuelta', {
        where: { id_detalle_venta },
        transaction,
    });
    return parseFloat(result || 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// Reingresar stock a StockDistribucion (inverso de FIFO)
// Devuelve el stock al lote más reciente de ese producto en la sucursal
// ─────────────────────────────────────────────────────────────────────────────
const reingresarStock = async (id_producto, id_sucursal, unidades, transaction) => {
    // Buscar el registro de stock más reciente para este producto en esta sucursal
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
        const err = new Error(
            `No se encontró un registro de stock para reingresar el producto. ` +
            `Posiblemente el lote fue eliminado.`
        );
        err.statusCode = 422;
        throw err;
    }

    await registro.increment('cantidad_actual', { by: unidades, transaction });

    return {
        id_lote: registro.id_lote,
        id_ubicacion: registro.id_ubicacion,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Lógica FIFO para descontar stock (reutilizada del módulo de ventas)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Validar y enriquecer items nuevos (para cambio de producto)
// ─────────────────────────────────────────────────────────────────────────────
const validarItemNuevo = async (item, id_sucursal, transaction) => {
    // 1. Buscamos el producto
    const producto = await Producto.findByPk(item.id_producto_nuevo, { transaction });
    if (!producto) {
        const err = new Error(`Producto nuevo ID "${item.id_producto_nuevo}" no encontrado.`);
        err.type = 'NOT_FOUND';
        throw err;
    }

    let factor_nuevo = 1;
    let precio_nuevo;

    // 2. Determinar el precio de venta
    if (item.id_presentacion_nueva) {
        const presentacion = await Presentacion.findOne({
            where: { id: item.id_presentacion_nueva, id_producto: item.id_producto_nuevo },
            transaction,
        });
        if (!presentacion) {
            const err = new Error(`Presentación inválida para "${producto.nombre_comercial}".`);
            err.type = 'NOT_FOUND';
            throw err;
        }
        factor_nuevo = parseFloat(presentacion.factor_conversion);
        precio_nuevo = parseFloat(presentacion.precio_especial);
    } else {
        if (producto.precio_venta === null || parseFloat(producto.precio_venta) <= 0) {
            // ERROR DE NEGOCIO: Datos inválidos para operar
            const err = new Error(`"${producto.nombre_comercial}" no tiene precio de venta definido o es 0.`);
            err.type = 'VALIDATION_ERROR';
            throw err;
        }
        precio_nuevo = parseFloat(producto.precio_venta);
    }

    // 3. Validar serie
    let productoSerieRef = null;
    if (producto.maneja_serie) {
        if (!item.numero_serie_nueva?.trim()) {
            const err = new Error(`"${producto.nombre_comercial}" requiere número de serie.`);
            err.type = 'VALIDATION_ERROR';
            throw err;
        }
        productoSerieRef = await ProductoSerie.findOne({
            where: { numero_serie: item.numero_serie_nueva.trim(), estado: 'DISPONIBLE' },
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
            const err = new Error(`Serie "${item.numero_serie_nueva}" no disponible para "${producto.nombre_comercial}".`);
            err.type = 'VALIDATION_ERROR';
            throw err;
        }
    }

    const cantidad_nueva = parseFloat(item.cantidad_nueva);
    const unidades_base_nuevas = cantidad_nueva * factor_nuevo;

    // 4. Validar Stock Disponible
    const { total: stockDisponible, registros } = await getStockDisponible(
        item.id_producto_nuevo,
        id_sucursal,
        transaction
    );

    if (stockDisponible < unidades_base_nuevas) {
        const err = new Error(
            `Stock insuficiente para "${producto.nombre_comercial}". Disponible: ${stockDisponible.toFixed(2)}, requerido: ${unidades_base_nuevas.toFixed(2)}.`
        );
        err.type = 'VALIDATION_ERROR';
        throw err;
    }

    const subtotal_nuevo = precio_nuevo * cantidad_nueva;

    return {
        factor_nuevo,
        precio_nuevo,
        subtotal_nuevo,
        unidades_base_nuevas,
        registrosFIFO: registros,
        id_lote_nuevo: registros[0]?.id_lote || null,
        id_ubicacion_nueva: registros[0]?.id_ubicacion || null,
        productoSerieRef,
    };
};

// ═══════════════════════════════════════════════════════════════════════════════
// CREAR DEVOLUCION (parcial o total)
// ═══════════════════════════════════════════════════════════════════════════════
export const crearDevolucion = async ({
    id_venta,
    id_sucursal,
    id_sesion_caja,
    id_usuario,
    items,
    motivo,
    metodo_reembolso = 'EFECTIVO',
}) => {
    // Buscar empleado
    const empleado = await Empleado.findOne({ where: { usuario_id: id_usuario } });
    if (!empleado) {
        const err = new Error('El usuario no tiene un empleado asociado.');
        err.statusCode = 400;
        throw err;
    }
    const id_empleado = empleado.id;

    // Validar sesión de caja
    const sesion = await SesionCaja.findOne({
        where: { id: id_sesion_caja, id_sucursal, id_empleado, estado: 'ABIERTA' },
    });
    if (!sesion) {
        const err = new Error('No existe sesión de caja activa.');
        err.statusCode = 403;
        throw err;
    }

    // Obtener venta original con detalles
    const ventaOriginal = await Venta.findByPk(id_venta, {
        include: [
            { model: DetalleVenta, as: 'detalles' },
            { model: Cliente, as: 'cliente' },
        ],
    });
    if (!ventaOriginal) {
        const err = new Error('Venta original no encontrada.');
        err.statusCode = 404;
        throw err;
    }

    const devolucionCreada = await sequelize.transaction(async (t) => {
        const detallesParaCrear = [];
        let totalDevuelto = 0;

        for (const item of items) {
            // Buscar el detalle de venta original
            const detalleOriginal = ventaOriginal.detalles.find(
                (d) => d.id === item.id_detalle_venta
            );
            if (!detalleOriginal) {
                const err = new Error(`Detalle de venta "${item.id_detalle_venta}" no encontrado en la venta.`);
                err.statusCode = 404;
                throw err;
            }

            // Validar cantidad
            const cantidadDevuelta = parseFloat(item.cantidad_devuelta);
            const cantidadOriginal = parseFloat(detalleOriginal.cantidad);
            const yaDevuelta = await getCantidadYaDevuelta(item.id_detalle_venta, t);
            const disponibleParaDevolver = cantidadOriginal - yaDevuelta;

            if (cantidadDevuelta <= 0 || cantidadDevuelta > disponibleParaDevolver) {
                const producto = await Producto.findByPk(detalleOriginal.id_producto, { transaction: t });
                const err = new Error(
                    `Cantidad inválida para devolución de "${producto?.nombre_comercial || 'producto'}". ` +
                    `Máximo devolvible: ${disponibleParaDevolver.toFixed(2)}, solicitado: ${cantidadDevuelta.toFixed(2)}.`
                );
                err.statusCode = 422;
                throw err;
            }

            // Calcular valores
            const factor_original = parseFloat(detalleOriginal.factor_aplicado);
            const precio_original = parseFloat(detalleOriginal.precio_unitario);
            const unidades_base = cantidadDevuelta * factor_original;
            const subtotal_devuelto = precio_original * cantidadDevuelta;

            // Reingresar stock
            const { id_lote, id_ubicacion } = await reingresarStock(
                detalleOriginal.id_producto,
                id_sucursal,
                unidades_base,
                t
            );

            // Manejar serie
            if (detalleOriginal.numero_serie) {
                await ProductoSerie.update(
                    { estado: 'DISPONIBLE' },
                    { where: { numero_serie: detalleOriginal.numero_serie }, transaction: t }
                );
            }

            // Registrar movimiento Kardex
            await KardexMovimiento.create({
                id_lote,
                tipo_movimiento: 'DEVOLUCION',
                cantidad: unidades_base,
                id_ubicacion_origen: null,
                id_ubicacion_destino: id_ubicacion,
                id_usuario,
                observacion: `Devolución de Venta ${ventaOriginal.numero_comprobante}`,
            }, { transaction: t });

            totalDevuelto += subtotal_devuelto;

            detallesParaCrear.push({
                id_detalle_venta: item.id_detalle_venta,
                id_producto_original: detalleOriginal.id_producto,
                id_presentacion_original: detalleOriginal.id_presentacion,
                cantidad_devuelta: cantidadDevuelta,
                factor_original,
                precio_original,
                subtotal_devuelto,
                numero_serie_devuelta: detalleOriginal.numero_serie,
            });
        }

        // Crear cabecera
        const numero_devolucion = await generarNumeroDevolucion(id_sucursal, t);

        const devolucion = await Devolucion.create({
            numero_devolucion,
            id_venta_original: id_venta,
            id_sucursal,
            id_sesion_caja,
            id_empleado,
            id_cliente: ventaOriginal.id_cliente,
            tipo: 'DEVOLUCION',
            motivo: motivo || null,
            metodo_reembolso,
            monto_devuelto: totalDevuelto.toFixed(2),
            monto_diferencia: 0,
        }, { transaction: t });

        // Crear detalles
        await DetalleDevolucion.bulkCreate(
            detallesParaCrear.map((d) => ({ ...d, id_devolucion: devolucion.id })),
            { transaction: t }
        );

        return devolucion;
    });

    // Descontar puntos de lealtad
    try {
        const cliente = ventaOriginal.cliente;
        if (cliente && cliente.ci !== '000000') {
            const puntosADescontar = Math.floor(parseFloat(devolucionCreada.monto_devuelto) / 50);
            if (puntosADescontar > 0) {
                const puntosActuales = parseInt(cliente.puntos || 0);
                const nuevosPuntos = Math.max(0, puntosActuales - puntosADescontar);
                await Cliente.update(
                    { puntos: nuevosPuntos },
                    { where: { id: cliente.id } }
                );
            }
        }
    } catch (e) {
        console.error('Error descontando puntos de lealtad:', e.message);
    }

    return getDevolucionById(devolucionCreada.id);
};

// ═══════════════════════════════════════════════════════════════════════════════
// CREAR CAMBIO DE PRODUCTO
// ═══════════════════════════════════════════════════════════════════════════════
export const crearCambio = async ({
    id_venta,
    id_sucursal,
    id_sesion_caja,
    id_usuario,
    items,
    motivo,
    metodo_reembolso = 'EFECTIVO',
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

    const ventaOriginal = await Venta.findByPk(id_venta, {
        include: [
            { model: DetalleVenta, as: 'detalles' },
            { model: Cliente, as: 'cliente' },
        ],
    });
    if (!ventaOriginal) {
        const err = new Error('Venta original no encontrada.');
        err.statusCode = 404;
        throw err;
    }

    const cambioCreado = await sequelize.transaction(async (t) => {
        const detallesParaCrear = [];
        let totalDevuelto = 0;
        let totalNuevo = 0;

        for (const item of items) {
            // ── PARTE 1: Devolver el producto original ────────────────────────
            const detalleOriginal = ventaOriginal.detalles.find(
                (d) => d.id === item.id_detalle_venta
            );
            if (!detalleOriginal) {
                const err = new Error(`Detalle de venta "${item.id_detalle_venta}" no encontrado.`);
                err.statusCode = 404;
                throw err;
            }

            const cantidadDevuelta = parseFloat(item.cantidad_devuelta);
            const cantidadOriginal = parseFloat(detalleOriginal.cantidad);
            const yaDevuelta = await getCantidadYaDevuelta(item.id_detalle_venta, t);
            const disponible = cantidadOriginal - yaDevuelta;

            if (cantidadDevuelta <= 0 || cantidadDevuelta > disponible) {
                const producto = await Producto.findByPk(detalleOriginal.id_producto, { transaction: t });
                const err = new Error(
                    `Cantidad inválida para cambio de "${producto?.nombre_comercial || 'producto'}". ` +
                    `Máximo: ${disponible.toFixed(2)}, solicitado: ${cantidadDevuelta.toFixed(2)}.`
                );
                err.statusCode = 422;
                throw err;
            }

            const factor_original = parseFloat(detalleOriginal.factor_aplicado);
            const precio_original = parseFloat(detalleOriginal.precio_unitario);
            const unidades_base_devueltas = cantidadDevuelta * factor_original;
            const subtotal_devuelto = precio_original * cantidadDevuelta;

            // Reingresar stock del producto original
            const { id_lote: id_lote_devuelto, id_ubicacion: id_ubicacion_devuelta } =
                await reingresarStock(detalleOriginal.id_producto, id_sucursal, unidades_base_devueltas, t);

            // Serie del producto original
            if (detalleOriginal.numero_serie) {
                await ProductoSerie.update(
                    { estado: 'DISPONIBLE' },
                    { where: { numero_serie: detalleOriginal.numero_serie }, transaction: t }
                );
            }

            // Kardex: reingreso del producto devuelto
            await KardexMovimiento.create({
                id_lote: id_lote_devuelto,
                tipo_movimiento: 'DEVOLUCION',
                cantidad: unidades_base_devueltas,
                id_ubicacion_origen: null,
                id_ubicacion_destino: id_ubicacion_devuelta,
                id_usuario,
                observacion: `Cambio (reingreso) de Venta ${ventaOriginal.numero_comprobante}`,
            }, { transaction: t });

            // ── PARTE 2: Entregar el producto nuevo ───────────────────────────
            const nuevoData = await validarItemNuevo(item, id_sucursal, t);

            // Descontar stock del producto nuevo
            await aplicarFIFO(nuevoData.registrosFIFO, nuevoData.unidades_base_nuevas, t);

            // Serie del producto nuevo
            if (nuevoData.productoSerieRef) {
                await nuevoData.productoSerieRef.update({ estado: 'VENDIDO' }, { transaction: t });
            }

            // Kardex: salida del producto nuevo
            await KardexMovimiento.create({
                id_lote: nuevoData.id_lote_nuevo,
                tipo_movimiento: 'VENTA',
                cantidad: nuevoData.unidades_base_nuevas,
                id_ubicacion_origen: nuevoData.id_ubicacion_nueva,
                id_ubicacion_destino: null,
                id_usuario,
                observacion: `Cambio (entrega nuevo) de Venta ${ventaOriginal.numero_comprobante}`,
            }, { transaction: t });

            totalDevuelto += subtotal_devuelto;
            totalNuevo += nuevoData.subtotal_nuevo;

            detallesParaCrear.push({
                id_detalle_venta: item.id_detalle_venta,
                id_producto_original: detalleOriginal.id_producto,
                id_presentacion_original: detalleOriginal.id_presentacion,
                cantidad_devuelta: cantidadDevuelta,
                factor_original,
                precio_original,
                subtotal_devuelto,
                numero_serie_devuelta: detalleOriginal.numero_serie,
                // Producto nuevo
                id_producto_nuevo: item.id_producto_nuevo,
                id_presentacion_nueva: item.id_presentacion_nueva || null,
                cantidad_nueva: parseFloat(item.cantidad_nueva),
                factor_nuevo: nuevoData.factor_nuevo,
                precio_nuevo: nuevoData.precio_nuevo,
                subtotal_nuevo: nuevoData.subtotal_nuevo,
                numero_serie_nueva: item.numero_serie_nueva?.trim() || null,
            });
        }

        // Diferencia: positivo = cliente paga más, negativo = cliente recibe reembolso
        const diferencia = totalNuevo - totalDevuelto;
        const montoDevuelto = diferencia < 0 ? Math.abs(diferencia) : 0;

        const numero_devolucion = await generarNumeroDevolucion(id_sucursal, t);

        const devolucion = await Devolucion.create({
            numero_devolucion,
            id_venta_original: id_venta,
            id_sucursal,
            id_sesion_caja,
            id_empleado,
            id_cliente: ventaOriginal.id_cliente,
            tipo: 'CAMBIO',
            motivo: motivo || null,
            metodo_reembolso,
            monto_devuelto: montoDevuelto.toFixed(2),
            monto_diferencia: diferencia.toFixed(2),
        }, { transaction: t });

        await DetalleDevolucion.bulkCreate(
            detallesParaCrear.map((d) => ({ ...d, id_devolucion: devolucion.id })),
            { transaction: t }
        );

        return devolucion;
    });

    // Ajustar puntos de lealtad (solo si hay reembolso neto)
    try {
        const cliente = ventaOriginal.cliente;
        if (cliente && cliente.ci !== '000000') {
            const diferencia = parseFloat(cambioCreado.monto_diferencia);
            if (diferencia < 0) {
                // El cliente recibe plata → descontar puntos proporcionales
                const puntosADescontar = Math.floor(Math.abs(diferencia) / 50);
                if (puntosADescontar > 0) {
                    const puntosActuales = parseInt(cliente.puntos || 0);
                    const nuevosPuntos = Math.max(0, puntosActuales - puntosADescontar);
                    await Cliente.update({ puntos: nuevosPuntos }, { where: { id: cliente.id } });
                }
            } else if (diferencia > 0) {
                // El cliente pagó más → sumar puntos adicionales
                const puntosGanados = Math.floor(diferencia / 50);
                if (puntosGanados > 0) {
                    await cliente.increment('puntos', { by: puntosGanados });
                }
            }
        }
    } catch (e) {
        console.error('Error ajustando puntos de lealtad en cambio:', e.message);
    }

    return getDevolucionById(cambioCreado.id);
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSULTAS
// ═══════════════════════════════════════════════════════════════════════════════

export const getDevolucionById = async (id) => {
    const devolucion = await Devolucion.findByPk(id, {
        include: [
            {
                model: Venta,
                as: 'venta_original',
                attributes: ['id', 'numero_comprobante', 'total', 'createdAt'],
            },
            {
                model: Cliente,
                as: 'cliente',
                attributes: ['id', 'nombre', 'ci', 'apellido_paterno', 'apellido_materno'],
            },
            {
                model: Empleado,
                as: 'empleado',
                attributes: ['id', 'nombre', 'apellido_paterno'],
            },
            {
                model: DetalleDevolucion,
                as: 'detalles',
                include: [
                    {
                        model: Producto,
                        as: 'producto_original',
                        attributes: ['id', 'nombre_comercial', 'codigo_barras'],
                    },
                    {
                        model: Producto,
                        as: 'producto_nuevo',
                        attributes: ['id', 'nombre_comercial', 'codigo_barras'],
                    },
                    {
                        model: Presentacion,
                        as: 'presentacion_original',
                        attributes: ['id', 'nombre', 'factor_conversion'],
                    },
                    {
                        model: Presentacion,
                        as: 'presentacion_nueva',
                        attributes: ['id', 'nombre', 'factor_conversion'],
                    },
                ],
            },
        ],
    });

    if (!devolucion) {
        const err = new Error('Devolución no encontrada.');
        err.statusCode = 404;
        throw err;
    }

    return devolucion;
};

export const findAllDevoluciones = async (query, userContext = {}) => {
    const filters = { ...query, ...userContext };
    const {
        where,
        limit,
        offset,
        order,
        page,
        perPage
    } = buildSequelizeQuery(filters, DEVOLUCION_CONFIG);

    if (query.desde || query.hasta) {
        where.createdAt = {};
        if (query.desde) where.createdAt[Op.gte] = new Date(query.desde);
        if (query.hasta) where.createdAt[Op.lte] = new Date(query.hasta);
    }

    if (query.tipo) {
        where.tipo = query.tipo;
    }

    const { rows: devoluciones, count: total } = await Devolucion.findAndCountAll({
        where,
        limit,
        offset,
        order: order || [['createdAt', 'DESC']],
        subQuery: false,
        distinct: true,
        include: [
            {
                model: Venta,
                as: 'venta_original',
                attributes: ['id', 'numero_comprobante', 'total'],
            },
            {
                model: Cliente,
                as: 'cliente',
                attributes: ['id', 'nombre', 'apellido_paterno', 'ci'],
            },
            {
                model: Empleado,
                as: 'empleado',
                attributes: ['id', 'nombre', 'apellido_paterno'],
            },
            {
                model: Sucursal,
                as: 'sucursal',
                attributes: ['id', 'nombre'],
            },
        ],
    });

    return {
        devoluciones,
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
    };
};

export const getDevolucionesByVenta = async (id_venta) => {
    const devoluciones = await Devolucion.findAll({
        where: { id_venta_original: id_venta },
        order: [['createdAt', 'DESC']],
        include: [
            {
                model: Empleado,
                as: 'empleado',
                attributes: ['id', 'nombre', 'apellido_paterno'],
            },
            {
                model: DetalleDevolucion,
                as: 'detalles',
                include: [
                    {
                        model: Producto,
                        as: 'producto_original',
                        attributes: ['id', 'nombre_comercial', 'codigo_barras'],
                    },
                    {
                        model: Producto,
                        as: 'producto_nuevo',
                        attributes: ['id', 'nombre_comercial', 'codigo_barras'],
                    },
                ],
            },
        ],
    });

    return devoluciones;
};

// ─────────────────────────────────────────────────────────────────────────────
// Resumen de devoluciones de una sesión de caja
// ─────────────────────────────────────────────────────────────────────────────
export const getResumenDevolucionesSesion = async (id_sesion_caja) => {
    const devoluciones = await Devolucion.findAll({
        where: { id_sesion_caja },
        attributes: ['tipo', 'monto_devuelto', 'monto_diferencia', 'metodo_reembolso'],
    });

    const resumen = {
        cantidad_devoluciones: 0,
        cantidad_cambios: 0,
        total_reembolsado_efectivo: 0,
        total_reembolsado_credito: 0,
        total_diferencias_cobradas: 0,
    };

    devoluciones.forEach((d) => {
        const devuelto = parseFloat(d.monto_devuelto);
        const diferencia = parseFloat(d.monto_diferencia);

        if (d.tipo === 'DEVOLUCION') {
            resumen.cantidad_devoluciones++;
            if (d.metodo_reembolso === 'EFECTIVO') {
                resumen.total_reembolsado_efectivo += devuelto;
            } else {
                resumen.total_reembolsado_credito += devuelto;
            }
        } else {
            resumen.cantidad_cambios++;
            if (diferencia > 0) {
                resumen.total_diferencias_cobradas += diferencia;
            } else if (diferencia < 0) {
                if (d.metodo_reembolso === 'EFECTIVO') {
                    resumen.total_reembolsado_efectivo += Math.abs(diferencia);
                } else {
                    resumen.total_reembolsado_credito += Math.abs(diferencia);
                }
            }
        }
    });

    return resumen;
};
