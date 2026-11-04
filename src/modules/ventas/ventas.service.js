import { Op } from 'sequelize';
import db from '../../database/index.js';
import { VENTA_CONFIG } from '../../common/applyFilters.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { emitirFactura, siguienteNumeroFactura, anularFacturaProveedor } from './facturacion.service.js';
import { METODOS_PAGO_VALIDOS, CI_CLIENTE_GENERICO } from '../../constants/business.constants.js';
import {
    NotFoundError,
    ConflictError,
    ForbiddenError,
    ValidationError,
    BusinessRuleError,
} from '../../errors/AppError.js';
import { clienteRepository } from '../clientes/clientes.repository.js';
import { clienteNuevoVentaSchema } from '../clientes/clientes.schema.js';
import { eventEmitter } from '../../services/event.service.js';
import { fechaCompacta, inicioDelDia, finDelDia } from '../../utils/fechas.js';
import { ventaListadoDTO, ventaDetalleDTO } from './ventas.dto.js';
import { whereStockVendible, whereLoteVendible, whereUbicacionVendible } from '../stock_distribucion/stock_vendible.js';

const {
    Venta,
    DetalleVenta,
    PagoVenta,
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
    UnidadMedida,
    Sucursal,
    Devolucion,
    DetalleDevolucion,
    Factura,
} = db;

// Cada MONTO_POR_PUNTO bolivianos de venta otorgan 1 punto de lealtad
const MONTO_POR_PUNTO = 50;

// Tolerancia para comparar cantidades decimales (evita errores de coma flotante)
const EPSILON = 1e-9;

const redondear2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const sumar = (lista, fn) => lista.reduce((acc, x) => acc + fn(x), 0);

// ─── Resolución de cliente ───────────────────────────────────────────────────
// El cliente se identifica solo por CI/NIT:
//   1. Sin CI (o con el CI genérico) → cliente genérico CI: 000000
//   2. CI registrado → ese cliente
//   3. CI no registrado → se valida que lleguen los datos requeridos y se crea
// ─────────────────────────────────────────────────────────────────────────────
const getClienteGenerico = async (transaction) => {
    const cliente = await Cliente.findOne({ where: { ci: CI_CLIENTE_GENERICO }, transaction });
    if (!cliente) {
        throw new NotFoundError(
            'Cliente genérico',
            `El cliente genérico (CI: ${CI_CLIENTE_GENERICO}) no existe. Regístrelo antes de vender sin cliente.`
        );
    }
    return cliente;
};

const resolverCliente = async (datosCliente, transaction) => {
    const ci = datosCliente?.ci?.trim();

    if (!ci || ci === CI_CLIENTE_GENERICO) {
        return { cliente: await getClienteGenerico(transaction), esNuevo: false };
    }

    const existente = await clienteRepository.findByCi(ci, { transaction });
    if (existente) {
        return { cliente: existente, esNuevo: false };
    }

    // Los puntos nunca se aceptan desde la venta
    const { puntos, ...datos } = datosCliente;
    const parsed = clienteNuevoVentaSchema.safeParse({ ...datos, ci });
    if (!parsed.success) {
        throw new ValidationError(
            parsed.error.issues.map((issue) => ({
                field: ['body', 'cliente', ...issue.path].join('.'),
                message: issue.message,
            })),
            `El cliente con CI ${ci} no está registrado: complete nombre y teléfono para registrarlo.`
        );
    }

    const nuevo = await clienteRepository.create(parsed.data, { transaction });
    return { cliente: nuevo, esNuevo: true };
};

// ─── Correlativo del comprobante ─────────────────────────────────────────────
const generarNumeroComprobante = async (id_sucursal, transaction) => {
    const prefijo = `TK-${id_sucursal.slice(0, 4).toUpperCase()}-${fechaCompacta()}`;

    // Serializa la generación del correlativo por prefijo hasta el fin de la transacción.
    // A diferencia de un FOR UPDATE sobre la última venta, también protege la primera
    // venta del día, cuando todavía no hay filas que bloquear.
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:prefijo))', {
        replacements: { prefijo },
        transaction,
    });

    // Sin filtrar por sucursal: si dos sucursales comparten el prefijo, comparten el
    // contador y el numero_comprobante (único) no se repite.
    const ultimo = await Venta.max('numero_comprobante', {
        where: { numero_comprobante: { [Op.like]: `${prefijo}-%` } },
        transaction,
    });

    const ultimoNum = ultimo ? parseInt(ultimo.split('-').pop(), 10) : 0;
    const siguiente = isNaN(ultimoNum) ? 1 : ultimoNum + 1;

    return `${prefijo}-${String(siguiente).padStart(4, '0')}`;
};

// ─── Stock ───────────────────────────────────────────────────────────────────
// Descuenta `unidades` de los registros (ya bloqueados y en orden FIFO) y retorna
// los movimientos reales: { id_lote, id_ubicacion, cantidad } por cada lote usado.
const aplicarFIFO = async (registros, unidades, transaction) => {
    let restante = unidades;
    const movimientos = [];

    for (const registro of registros) {
        if (restante <= EPSILON) break;

        const disponible = parseFloat(registro.cantidad_actual);
        if (disponible <= 0) continue;

        const aDescontar = Math.min(disponible, restante);

        await registro.decrement('cantidad_actual', { by: aDescontar, transaction });
        // La fila sigue bloqueada por esta transacción: se actualiza el valor en memoria
        // para que otro ítem del mismo producto vea el stock que queda.
        registro.setDataValue('cantidad_actual', disponible - aDescontar);

        movimientos.push({
            id_lote: registro.id_lote,
            id_ubicacion: registro.id_ubicacion,
            cantidad: aDescontar,
        });

        restante -= aDescontar;
    }

    if (restante > EPSILON) {
        throw new BusinessRuleError('Stock insuficiente durante el descuento FIFO.', 'STOCK_INSUFICIENTE');
    }

    return movimientos;
};

// Stock vendible en la sucursal de todos los productos, en una sola consulta (mismas
// condiciones que el POS, ver stock_vendible.js).
// Retorna Map<id_producto, registros[]> en orden FIFO (lote más antiguo primero).
const cargarStockFIFO = async (productos, id_sucursal, transaction) => {
    const registros = await StockDistribucion.findAll({
        where: whereStockVendible(),
        include: [
            {
                model: Lote,
                as: 'lote',
                where: whereLoteVendible(productos),
                attributes: ['id', 'id_producto', 'fecha_ingreso'],
                required: true,
            },
            {
                model: Ubicacion,
                as: 'ubicacion',
                where: whereUbicacionVendible(id_sucursal),
                attributes: [],
                required: true,
            },
        ],
        order: [[{ model: Lote, as: 'lote' }, 'fecha_ingreso', 'ASC'], ['id', 'ASC']],
        // OF: bloquea solo las filas de stock; sin OF también se bloquearían Lote y Ubicacion
        lock: { level: transaction.LOCK.UPDATE, of: StockDistribucion },
        transaction,
    });

    const porProducto = new Map(productos.map((p) => [p.id, []]));
    for (const registro of registros) {
        porProducto.get(registro.lote.id_producto).push(registro);
    }
    return porProducto;
};

// Series disponibles, en una sola consulta. Retorna Map<'numero_serie::id_producto', ProductoSerie>.
const cargarSeriesDisponibles = async (numerosSerie, transaction) => {
    if (numerosSerie.length === 0) return new Map();

    const series = await ProductoSerie.findAll({
        where: { numero_serie: numerosSerie, estado: 'DISPONIBLE' },
        include: [{
            model: Lote,
            as: 'lote',
            attributes: ['id_producto'],
            required: true,
        }],
        lock: { level: transaction.LOCK.UPDATE, of: ProductoSerie },
        transaction,
    });

    return new Map(series.map((s) => [`${s.numero_serie}::${s.lote.id_producto}`, s]));
};

// Solo lotes y ubicaciones activos: si el stock vuelve a uno inactivo, el POS no lo ve
const reingresarStock = async (id_producto, id_sucursal, unidades, transaction) => {
    const registro = await StockDistribucion.findOne({
        where: { esta_activo: true },
        include: [
            {
                model: Lote,
                as: 'lote',
                where: { id_producto, esta_activo: true },
                attributes: ['id', 'codigo_lote', 'fecha_ingreso'],
                required: true,
            },
            {
                model: Ubicacion,
                as: 'ubicacion',
                where: whereUbicacionVendible(id_sucursal),
                attributes: ['id', 'nombre'],
                required: true,
            },
        ],
        order: [[{ model: Lote, as: 'lote' }, 'fecha_ingreso', 'DESC']],
        transaction,
        lock: { level: transaction.LOCK.UPDATE, of: StockDistribucion },
    });

    if (!registro) {
        throw new BusinessRuleError('No se encontró un registro de stock para reingresar el producto.');
    }

    await registro.increment('cantidad_actual', { by: unidades, transaction });

    return {
        id_lote: registro.id_lote,
        id_ubicacion: registro.id_ubicacion,
    };
};

// ─── Validación de ítems ─────────────────────────────────────────────────────
// Carga productos, presentaciones, series y stock en lote (una consulta por tipo),
// calcula precios y subtotales, y valida el stock sumando lo requerido por producto.
const validarYEnriquecerItems = async (items, id_sucursal, transaction) => {
    const idsProducto = [...new Set(items.map((i) => i.id_producto))];
    const idsPresentacion = [...new Set(items.map((i) => i.id_presentacion).filter(Boolean))];

    const productos = await Producto.findAll({
        where: { id: idsProducto },
        attributes: ['id', 'nombre_comercial', 'codigo_barras', 'precio_venta', 'maneja_vencimiento'],
        include: [{ model: UnidadMedida, as: 'unidad_medida', attributes: ['id', 'nombre', 'abreviatura'] }],
        transaction,
    });
    const productosPorId = new Map(productos.map((p) => [p.id, p]));

    const presentaciones = idsPresentacion.length > 0
        ? await Presentacion.findAll({
            where: { id: idsPresentacion },
            attributes: ['id', 'id_producto', 'nombre', 'factor_conversion', 'precio_especial'],
            transaction,
        })
        : [];
    const presentacionesPorId = new Map(presentaciones.map((p) => [p.id, p]));

    const itemsEnriquecidos = items.map((item) => {
        const producto = productosPorId.get(item.id_producto);
        if (!producto) {
            throw new NotFoundError('Producto', `Producto ID "${item.id_producto}" no encontrado.`);
        }

        let factor_aplicado = 1;
        let precio_unitario;
        let presentacion = null;

        if (item.id_presentacion) {
            presentacion = presentacionesPorId.get(item.id_presentacion);
            if (!presentacion || presentacion.id_producto !== producto.id) {
                throw new NotFoundError(
                    'Presentación',
                    `Presentación inválida para "${producto.nombre_comercial}".`
                );
            }
            if (presentacion.precio_especial === null || presentacion.precio_especial === undefined) {
                throw new BusinessRuleError(
                    `La presentación "${presentacion.nombre}" de "${producto.nombre_comercial}" no tiene precio definido.`
                );
            }
            factor_aplicado = parseFloat(presentacion.factor_conversion);
            precio_unitario = parseFloat(presentacion.precio_especial);
        } else {
            if (producto.precio_venta === null || producto.precio_venta === undefined) {
                throw new BusinessRuleError(
                    `"${producto.nombre_comercial}" no tiene precio de venta general definido.`
                );
            }
            precio_unitario = parseFloat(producto.precio_venta);
        }

        const numero_serie = item.numero_serie?.trim() || null;
        if (producto.maneja_serie && !numero_serie) {
            throw new BusinessRuleError(`"${producto.nombre_comercial}" requiere número de serie.`);
        }

        const cantidad = parseFloat(item.cantidad);
        const monto_descuento = redondear2(parseFloat(item.monto_descuento || 0));
        const importe = redondear2(precio_unitario * cantidad);

        // El SIAT valida subTotal = cantidad × precioUnitario − montoDescuento por ítem,
        // así que el descuento (en Bs) no puede superar el importe del ítem.
        if (monto_descuento > importe + EPSILON) {
            throw new BusinessRuleError(
                `El descuento de "${producto.nombre_comercial}" (Bs ${monto_descuento.toFixed(2)}) ` +
                `no puede superar su importe (Bs ${importe.toFixed(2)}).`,
                'DESCUENTO_EXCEDE_IMPORTE'
            );
        }

        return {
            producto,
            presentacion,
            cantidad,
            factor_aplicado,
            precio_unitario,
            monto_descuento,
            subtotal: redondear2(importe - monto_descuento),
            numero_serie,
            unidades_base: cantidad * factor_aplicado,
            productoSerie: null,
            registrosFIFO: [],
        };
    });

    // ── Series ────────────────────────────────────────────────────────────────
    const itemsConSerie = itemsEnriquecidos.filter((i) => i.producto.maneja_serie);
    const seriesDisponibles = await cargarSeriesDisponibles(
        itemsConSerie.map((i) => i.numero_serie),
        transaction
    );
    for (const item of itemsConSerie) {
        item.productoSerie = seriesDisponibles.get(`${item.numero_serie}::${item.producto.id}`);
        if (!item.productoSerie) {
            throw new BusinessRuleError(
                `Serie "${item.numero_serie}" no disponible para "${item.producto.nombre_comercial}".`
            );
        }
    }

    // ── Stock: se valida contra lo requerido por producto (unidad + presentaciones) ──
    const stockPorProducto = await cargarStockFIFO(productos, id_sucursal, transaction);

    const requeridoPorProducto = new Map();
    for (const item of itemsEnriquecidos) {
        const id = item.producto.id;
        requeridoPorProducto.set(id, (requeridoPorProducto.get(id) || 0) + item.unidades_base);
    }

    for (const [id_producto, requerido] of requeridoPorProducto) {
        const disponible = sumar(stockPorProducto.get(id_producto), (r) => parseFloat(r.cantidad_actual));
        if (disponible + EPSILON < requerido) {
            const { nombre_comercial } = productosPorId.get(id_producto);
            throw new BusinessRuleError(
                `Stock insuficiente para "${nombre_comercial}". ` +
                `Disponible: ${disponible.toFixed(2)}, requerido: ${requerido.toFixed(2)}.`,
                'STOCK_INSUFICIENTE'
            );
        }
    }

    for (const item of itemsEnriquecidos) {
        item.registrosFIFO = stockPorProducto.get(item.producto.id);
    }

    return itemsEnriquecidos;
};

// ─── Crear venta ─────────────────────────────────────────────────────────────
// `sesion` es la sesión de caja abierta del cajero (req.sesionCaja, del middleware
// requireSesionAbierta); de ella salen la sucursal y el empleado.
export const crearVenta = async ({
    sesion, id_usuario, name_user,
    id_sesion_caja,
    cliente: datosCliente,
    items, tipo_descuento_global, valor_descuento_global = 0,
    pagos, notas,
    facturar = false,
    porcentaje_recargo_iva = 0,
}) => {
    if (id_sesion_caja && id_sesion_caja !== sesion.id) {
        throw new ForbiddenError('La sesión de caja indicada no es la sesión abierta del cajero.');
    }

    // También se valida en crearVentaSchema; se repite porque proformas llama a este servicio directamente
    if (facturar && (!datosCliente?.ci || datosCliente.ci === CI_CLIENTE_GENERICO)) {
        throw new BusinessRuleError(
            'Para facturar debe enviar el CI/NIT del cliente.',
            'CLIENTE_REQUERIDO_PARA_FACTURAR'
        );
    }

    const porcentajeRecargo = facturar ? parseFloat(porcentaje_recargo_iva) || 0 : 0;
    if (porcentajeRecargo < 0 || porcentajeRecargo > 100) {
        throw new BusinessRuleError('El porcentaje de recargo por factura debe estar entre 0 y 100.');
    }

    const { id: idSesion, id_sucursal, id_empleado } = sesion;
    const tipoDescuento = tipo_descuento_global || 'NINGUNO';
    const monto_pagado = redondear2(sumar(pagos, (p) => parseFloat(p.monto)));
    const pagado_no_efectivo = redondear2(
        sumar(pagos.filter((p) => p.metodo_pago !== 'EFECTIVO'), (p) => parseFloat(p.monto))
    );

    let clienteCreado = null;

    const venta = await sequelize.transaction(async (t) => {
        const { cliente, esNuevo } = await resolverCliente(datosCliente, t);
        if (esNuevo) clienteCreado = cliente;

        const itemsEnriquecidos = await validarYEnriquecerItems(items, id_sucursal, t);
        const subtotal = redondear2(sumar(itemsEnriquecidos, (i) => i.subtotal));

        let monto_descuento_global = 0;
        if (tipoDescuento === 'PORCENTAJE') {
            monto_descuento_global = redondear2((subtotal * parseFloat(valor_descuento_global)) / 100);
        } else if (tipoDescuento === 'FIJO') {
            monto_descuento_global = redondear2(parseFloat(valor_descuento_global));
        }

        // El descuento global se aplica sobre la suma de los ítems (va al SIAT como descuentoAdicional)
        if (monto_descuento_global > subtotal + EPSILON) {
            throw new BusinessRuleError(
                `El descuento global (Bs ${monto_descuento_global.toFixed(2)}) ` +
                `no puede superar la suma de los productos (Bs ${subtotal.toFixed(2)}).`,
                'DESCUENTO_EXCEDE_TOTAL'
            );
        }

        // Monto que se factura al SIAT; el recargo se cobra encima y no va en la factura
        const totalSinRecargo = redondear2(subtotal - monto_descuento_global);
        const monto_recargo_iva = redondear2((totalSinRecargo * porcentajeRecargo) / 100);
        const total = redondear2(totalSinRecargo + monto_recargo_iva);
        const cambio_entregado = redondear2(monto_pagado - total);

        if (cambio_entregado < 0) {
            throw new BusinessRuleError('El monto pagado no cubre el total de la venta.', 'PAGO_INSUFICIENTE');
        }

        if (pagado_no_efectivo > total) {
            throw new BusinessRuleError(
                'Los pagos que no son en efectivo no pueden superar el total: el cambio solo se entrega en efectivo.',
                'PAGO_EXCEDE_TOTAL'
            );
        }

        const numero_comprobante = await generarNumeroComprobante(id_sucursal, t);

        const venta = await Venta.create({
            numero_comprobante,
            id_sucursal,
            id_sesion_caja: idSesion,
            id_empleado,
            id_cliente: cliente.id,
            subtotal: subtotal.toFixed(2),
            tipo_descuento_global: tipoDescuento,
            valor_descuento_global,
            monto_descuento_global: monto_descuento_global.toFixed(2),
            porcentaje_recargo_iva: porcentajeRecargo.toFixed(2),
            monto_recargo_iva: monto_recargo_iva.toFixed(2),
            total: total.toFixed(2),
            monto_pagado: monto_pagado.toFixed(2),
            cambio_entregado: cambio_entregado.toFixed(2),
            notas: notas || null,
        }, { transaction: t });

        await DetalleVenta.bulkCreate(
            itemsEnriquecidos.map((item) => ({
                id_venta: venta.id,
                id_producto: item.producto.id,
                id_presentacion: item.presentacion?.id || null,
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
            pagos.map((p, idx) => ({
                id_venta: venta.id,
                metodo_pago: p.metodo_pago,
                orden: idx,
                monto: parseFloat(p.monto).toFixed(2),
                referencia: p.referencia || null,
            })),
            { transaction: t }
        );

        // ── Stock y Kardex: un movimiento por cada lote realmente descontado ──
        const movimientosKardex = [];
        for (const item of itemsEnriquecidos) {
            const movimientos = await aplicarFIFO(item.registrosFIFO, item.unidades_base, t);
            movimientosKardex.push(...movimientos.map((mov) => ({
                id_lote: mov.id_lote,
                tipo_movimiento: 'VENTA',
                cantidad: mov.cantidad,
                id_ubicacion_origen: mov.id_ubicacion,
                id_ubicacion_destino: null,
                id_usuario,
                observacion: `Venta ${numero_comprobante}`,
            })));
        }
        await KardexMovimiento.bulkCreate(movimientosKardex, { transaction: t });

        const idsSeriesVendidas = itemsEnriquecidos
            .filter((i) => i.productoSerie)
            .map((i) => i.productoSerie.id);
        if (idsSeriesVendidas.length > 0) {
            await ProductoSerie.update(
                { estado: 'VENDIDO' },
                { where: { id: idsSeriesVendidas }, transaction: t }
            );
        }

        // ── Puntos de lealtad (atómico con la venta; el recargo por factura no suma puntos) ──
        const puntosGanados = cliente.ci !== CI_CLIENTE_GENERICO ? Math.floor(totalSinRecargo / MONTO_POR_PUNTO) : 0;
        if (puntosGanados > 0) {
            await Cliente.increment('puntos', {
                by: puntosGanados,
                where: { id: cliente.id },
                transaction: t,
            });
        }

        // ── Factura PENDIENTE: último paso, para no consumir números de la secuencia
        //    si algo anterior falla. Si el proceso se cae antes de emitirla, queda el
        //    registro PENDIENTE para reintentar.
        if (facturar) {
            await Factura.create({
                id_venta: venta.id,
                estado: 'PENDIENTE',
                numero_factura: await siguienteNumeroFactura(t),
            }, { transaction: t });
        }

        return venta;
    });

    if (clienteCreado) {
        eventEmitter.emit('cliente.created', {
            clienteId: clienteCreado.id,
            ci: clienteCreado.ci,
            nombre: clienteCreado.nombre,
        });
    }

    // ── Facturación (fuera de la transacción DB, la venta ya está registrada) ──
    let resultadoFacturacion = null;
    if (facturar) {
        try {
            resultadoFacturacion = await emitirFactura(venta.id, name_user);
        } catch (e) {
            console.error('[Facturación] Error inesperado al emitir la factura:', e.message);
            resultadoFacturacion = { success: false, error: e.message };
        }
    }

    // Mismo formato que GET /ventas/:id (incluye la factura ya actualizada)
    return {
        ...(await getVentaById(venta.id)),
        resultado_facturacion: resultadoFacturacion,
    };
};

// ─── Facturación posterior a la venta ────────────────────────────────────────
// POST /ventas/:id/facturar (venta que nunca tuvo factura) y POST /ventas/:id/reintentar-factura
// (factura vigente en PENDIENTE/ERROR, o la última anulada). La factura se arma con los
// detalles, pagos y cliente guardados en la venta.

// Bloquea la venta para que dos solicitudes simultáneas no la facturen dos veces.
// `factura` es la vigente (las anuladas no se incluyen).
const cargarVentaParaFacturar = (id_venta, transaction) => Venta.findByPk(id_venta, {
    include: [
        { model: Cliente, as: 'cliente', attributes: ['id', 'ci', 'puntos'] },
        { model: Factura, as: 'factura', attributes: ['id', 'estado', 'numero_factura'] },
    ],
    lock: { level: transaction.LOCK.UPDATE, of: Venta },
    transaction,
});

const validarVentaFacturable = async (venta, transaction) => {
    if (!venta) {
        throw new NotFoundError('Venta', 'Venta no encontrada.');
    }

    if (!venta.esta_activo) {
        throw new ConflictError('No se puede facturar una venta anulada.');
    }

    if (venta.factura?.estado === 'FACTURADA') {
        throw new ConflictError(
            `La venta ${venta.numero_comprobante} ya fue facturada (factura N° ${venta.factura.numero_factura}).`
        );
    }

    if (!venta.cliente?.ci || venta.cliente.ci === CI_CLIENTE_GENERICO) {
        throw new BusinessRuleError(
            'Para facturar, la venta debe tener un cliente con CI/NIT.',
            'CLIENTE_REQUERIDO_PARA_FACTURAR'
        );
    }

    // La factura se arma con los detalles originales: si hubo devoluciones o cambios
    // ya no coinciden con lo que el cliente se llevó.
    const devoluciones = await Devolucion.count({
        where: { id_venta_original: venta.id, estado: 'COMPLETADA', esta_activo: true },
        transaction,
    });
    if (devoluciones > 0) {
        throw new BusinessRuleError(
            'No se puede facturar una venta con devoluciones o cambios registrados.',
            'VENTA_CON_DEVOLUCIONES'
        );
    }
};

// Recargo por factura de una venta que nunca tuvo factura (sin recargo previo), con la regla
// de crearVenta: monto = total × porcentaje / 100. El cliente lo paga aparte: se registra
// como un PagoVenta más (para que caja y reportes, que suman los pagos, cuadren) y se suma
// a monto_pagado, así cambio_entregado (= monto_pagado − total) no cambia. Como en
// crearVenta, no va en la factura ni suma puntos de lealtad.
const aplicarRecargoFactura = async (venta, porcentajeRecargo, metodoPago, transaction) => {
    if (porcentajeRecargo < 0 || porcentajeRecargo > 100) {
        throw new BusinessRuleError('El porcentaje de recargo por factura debe estar entre 0 y 100.');
    }

    const totalSinRecargo = parseFloat(venta.total);
    const montoRecargo = redondear2((totalSinRecargo * porcentajeRecargo) / 100);
    if (montoRecargo <= 0) return;

    // `total` incluye el recargo (ver Venta): emitirFactura lo resta para obtener
    // el monto que va al SIAT, por eso se actualiza junto con el recargo.
    await venta.update({
        porcentaje_recargo_iva: porcentajeRecargo.toFixed(2),
        monto_recargo_iva: montoRecargo.toFixed(2),
        total: redondear2(totalSinRecargo + montoRecargo).toFixed(2),
        monto_pagado: redondear2(parseFloat(venta.monto_pagado) + montoRecargo).toFixed(2),
    }, { transaction });

    // Al final: el pago de orden 0 define el método de pago de la factura
    const ultimoOrden = await PagoVenta.max('orden', { where: { id_venta: venta.id }, transaction });
    await PagoVenta.create({
        id_venta: venta.id,
        metodo_pago: metodoPago,
        orden: (ultimoOrden ?? -1) + 1,
        monto: montoRecargo.toFixed(2),
        referencia: 'Recargo por factura',
    }, { transaction });
};

// Pasa la venta (y su próxima factura) a otro cliente ya registrado, junto con los puntos
// de lealtad que otorgó (misma regla que crearVenta: sin el recargo).
const cambiarClienteVenta = async (venta, id_cliente, transaction) => {
    const nuevoCliente = await Cliente.findByPk(id_cliente, {
        attributes: ['id', 'ci', 'esta_activo'],
        transaction,
    });

    if (!nuevoCliente) {
        throw new NotFoundError('Cliente', 'Cliente no encontrado.');
    }
    if (!nuevoCliente.esta_activo) {
        throw new BusinessRuleError('El cliente seleccionado está inactivo.', 'CLIENTE_INACTIVO');
    }
    if (!nuevoCliente.ci || nuevoCliente.ci === CI_CLIENTE_GENERICO) {
        throw new BusinessRuleError(
            'Para facturar, el cliente debe tener CI/NIT.',
            'CLIENTE_REQUERIDO_PARA_FACTURAR'
        );
    }

    const totalSinRecargo = parseFloat(venta.total) - parseFloat(venta.monto_recargo_iva || 0);
    const puntos = Math.floor(totalSinRecargo / MONTO_POR_PUNTO);
    const anterior = venta.cliente;

    if (puntos > 0) {
        if (anterior && anterior.ci !== CI_CLIENTE_GENERICO) {
            await Cliente.update(
                { puntos: Math.max(0, parseInt(anterior.puntos || 0) - puntos) },
                { where: { id: anterior.id }, transaction }
            );
        }
        await Cliente.increment('puntos', { by: puntos, where: { id: nuevoCliente.id }, transaction });
    }

    await venta.update({ id_cliente: nuevoCliente.id }, { transaction });
    // validarVentaFacturable revisa el CI del cliente cargado en la venta
    venta.cliente = nuevoCliente;
};

// Emite la factura vigente fuera de la transacción (la factura PENDIENTE ya está registrada)
// y responde con el mismo formato que GET /ventas/:id.
const emitirYObtenerVenta = async (id_venta, name_user) => {
    let resultadoFacturacion;
    try {
        resultadoFacturacion = await emitirFactura(id_venta, name_user);
    } catch (e) {
        console.error('[Facturación] Error inesperado al emitir la factura:', e.message);
        resultadoFacturacion = { success: false, error: e.message };
    }

    return {
        ...(await getVentaById(id_venta)),
        resultado_facturacion: resultadoFacturacion,
    };
};

// Con `id_cliente` (p. ej. una venta hecha a Público General) la venta pasa a ese cliente
// registrado, solo si es de la sesión de caja abierta del cajero (`id_sesion_abierta`):
// evita facturar ventas antiguas a nombre de otra persona.
export const facturarVenta = async ({
    id_venta, porcentaje_recargo_iva = 0, metodo_pago_recargo = 'EFECTIVO',
    id_cliente, id_sesion_abierta, name_user,
}) => {
    const porcentajeRecargo = parseFloat(porcentaje_recargo_iva) || 0;

    await sequelize.transaction(async (t) => {
        const venta = await cargarVentaParaFacturar(id_venta, t);

        if (venta && id_cliente && id_cliente !== venta.id_cliente) {
            if (!id_sesion_abierta || venta.id_sesion_caja !== id_sesion_abierta) {
                throw new BusinessRuleError(
                    'Solo se puede cambiar el cliente al facturar ventas de su sesión de caja abierta.',
                    'VENTA_DE_OTRA_SESION'
                );
            }
            await cambiarClienteVenta(venta, id_cliente, t);
        }

        await validarVentaFacturable(venta, t);

        const facturasPrevias = await Factura.count({ where: { id_venta: venta.id }, transaction: t });
        if (facturasPrevias > 0) {
            throw new ConflictError(
                `La venta ${venta.numero_comprobante} ya tiene facturas registradas. Use la opción de reintentar factura.`
            );
        }

        if (porcentajeRecargo > 0) {
            await aplicarRecargoFactura(venta, porcentajeRecargo, metodo_pago_recargo, t);
        }

        // Último paso, como en crearVenta, para no consumir números de la secuencia si algo falla
        await Factura.create({
            id_venta: venta.id,
            estado: 'PENDIENTE',
            numero_factura: await siguienteNumeroFactura(t),
        }, { transaction: t });
    });

    return emitirYObtenerVenta(id_venta, name_user);
};

// Solo corrige datos fiscales: los montos (incluido el recargo, que ya se cobró y no va en la
// factura) no cambian. Sin `id_cliente` se usa el cliente de la venta (con sus datos ya
// corregidos); con otro `id_cliente` registrado, la venta pasa a ese cliente.
export const reintentarFacturaVenta = async ({ id_venta, id_cliente, name_user }) => {
    await sequelize.transaction(async (t) => {
        const venta = await cargarVentaParaFacturar(id_venta, t);

        if (venta && id_cliente && id_cliente !== venta.id_cliente) {
            await cambiarClienteVenta(venta, id_cliente, t);
        }

        await validarVentaFacturable(venta, t);

        const facturasPrevias = await Factura.count({ where: { id_venta: venta.id }, transaction: t });
        if (facturasPrevias === 0) {
            throw new ConflictError(
                `La venta ${venta.numero_comprobante} no tiene factura. Use la opción de facturar venta.`
            );
        }

        // Sin factura vigente (la última se anuló): nueva factura con el siguiente número.
        // Una vigente en PENDIENTE/ERROR conserva su número.
        if (!venta.factura) {
            await Factura.create({
                id_venta: venta.id,
                estado: 'PENDIENTE',
                numero_factura: await siguienteNumeroFactura(t),
            }, { transaction: t });
        }
    });

    return emitirYObtenerVenta(id_venta, name_user);
};

// ─── Anular la factura de una venta ──────────────────────────────────────────
// Solo para corregir un dato mal enviado: anula la factura en el SIAT y la deja como
// historial, sin tocar la venta (recargo, total y cambio quedan igual). Después se
// vuelve a emitir con POST /ventas/:id/reintentar-factura (nueva factura y número).
export const anularFacturaVenta = async ({ id_venta }) => {
    const venta = await Venta.findByPk(id_venta, {
        include: [{ model: Factura, as: 'factura', attributes: ['id', 'estado', 'numero_factura', 'cuf'] }],
    });

    if (!venta) {
        throw new NotFoundError('Venta', 'Venta no encontrada.');
    }

    const { factura } = venta;
    if (factura?.estado !== 'FACTURADA') {
        throw new ConflictError(`La venta ${venta.numero_comprobante} no tiene una factura emitida para anular.`);
    }

    if (!factura.cuf) {
        throw new BusinessRuleError(
            `La factura N° ${factura.numero_factura} no tiene CUF registrado: no se puede anular en el SIAT.`,
            'FACTURA_SIN_CUF'
        );
    }

    const resultado = await anularFacturaProveedor(factura.cuf);
    if (!resultado.success) {
        throw new BusinessRuleError(
            `No se pudo anular la factura N° ${factura.numero_factura}: ${resultado.error}`,
            'ANULACION_RECHAZADA'
        );
    }

    const [anuladas] = await Factura.update(
        { estado: 'ANULADA', fecha_anulacion: new Date() },
        { where: { id: factura.id, estado: 'FACTURADA' } }
    );
    // Otra solicitud simultánea ya la anuló
    if (anuladas === 0) {
        throw new ConflictError(`La factura N° ${factura.numero_factura} ya fue anulada.`);
    }

    return getVentaById(id_venta);
};

export const anularVenta = async (id_venta, id_usuario) => {
    const empleado = await Empleado.findOne({ where: { usuario_id: id_usuario } });
    if (!empleado) {
        throw new ForbiddenError('El usuario no tiene un empleado asociado.');
    }

    const venta = await Venta.findByPk(id_venta, {
        include: [
            { model: DetalleVenta, as: 'detalles' },
            { model: Cliente, as: 'cliente' },
            { model: Factura, as: 'factura', attributes: ['id', 'estado', 'numero_factura'] },
        ],
    });

    if (!venta) {
        throw new NotFoundError('Venta', 'Venta no encontrada.');
    }

    if (!venta.esta_activo) {
        throw new ConflictError('La venta ya se encuentra anulada.');
    }

    if (venta.factura?.estado === 'FACTURADA') {
        throw new ConflictError(
            `La venta tiene la factura N° ${venta.factura.numero_factura} vigente. Anule primero la factura.`
        );
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
        if (cliente && cliente.ci !== CI_CLIENTE_GENERICO) {
            // Los puntos se otorgaron sin el recargo por factura (ver crearVenta)
            const totalVenta = parseFloat(venta.total) - parseFloat(venta.monto_recargo_iva || 0);
            const puntosADescontar = Math.floor(totalVenta / MONTO_POR_PUNTO);

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
                model: Factura,
                as: 'factura',
                attributes: { exclude: ['xml_factura'] },
            },
            {
                model: Factura,
                as: 'facturas',
                where: { estado: 'ANULADA' },
                required: false,
                attributes: ['id', 'numero_factura', 'cuf', 'fecha_emision', 'fecha_anulacion', 'url_factura_pdf', 'url_siat'],
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
                        // El producto devuelto es el de la línea de venta (id_detalle_venta);
                        // solo se carga el producto que se entrega en un cambio.
                        include: [
                            {
                                model: Producto,
                                as: 'producto_nuevo',
                                attributes: ['id', 'nombre_comercial', 'codigo_barras'],
                                include: [{ model: UnidadMedida, as: 'unidad_medida', attributes: ['id', 'nombre', 'abreviatura'] }]
                            },
                            { model: Presentacion, as: 'presentacion_nueva', attributes: ['id', 'nombre', 'factor_conversion'] }
                        ]
                    }
                ]
            }
        ],
        order: [
            [{ model: PagoVenta, as: 'pagos' }, 'orden', 'ASC'],
            [{ model: Devolucion, as: 'devoluciones' }, 'createdAt', 'ASC'],
            [{ model: Factura, as: 'facturas' }, 'fecha_anulacion', 'ASC'],
        ],
    });

    if (!v) {
        throw new NotFoundError('Venta', 'Venta no encontrada.');
    }

    return ventaDetalleDTO(v);
};

// ─── Listado de ventas ───────────────────────────────────────────────────────
// Solo relaciones 1:1 en el JOIN (cliente, cajero, sucursal, factura): así LIMIT/OFFSET
// cuentan ventas y no filas repetidas. Pagos y devoluciones van en consultas aparte
// (`separate: true`).
const includesListado = () => [
    { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'apellido_paterno', 'apellido_materno', 'ci'] },
    { model: Empleado, as: 'cajero', attributes: ['id', 'nombre', 'apellido_paterno', 'apellido_materno'] },
    { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] },
];

// Resumen de todas las ventas del filtro (no solo de la página)
const calcularResumenVentas = async (where) => {
    const cantidad_registradas = await Venta.count({
        where: { ...where, esta_activo: true },
        // Los JOIN 1:1 se necesitan para el filtro `search` ($cliente.nombre$, $cajero.nombre$...)
        include: includesListado().map((inc) => ({ ...inc, attributes: [] })),
        distinct: true,
        col: 'id',
    });

    return { cantidad_registradas };
};

// `query` ya viene validado por listarVentasSchema
export const findAllVentas = async (query) => {
    const { where, limit, offset, order, page, perPage } = buildSequelizeQuery(query, VENTA_CONFIG);

    if (query.desde || query.hasta) {
        where.createdAt = {};
        // inicioDelDia/finDelDia aceptan 'YYYY-MM-DD' o un ISO completo (lo convierten al día de Bolivia)
        if (query.desde) {
            where.createdAt[Op.gte] = inicioDelDia(query.desde);
        }
        if (query.hasta) {
            where.createdAt[Op.lte] = finDelDia(query.hasta);
        }
    }

    if (query.metodo_pago) {
        where.id = {
            [Op.in]: sequelize.literal(`(SELECT "id_venta" FROM "PagosVenta" WHERE "metodo_pago" = ${sequelize.escape(query.metodo_pago)})`)
        };
    }

    const [{ rows, count: total }, resumen] = await Promise.all([
        Venta.findAndCountAll({
            where,
            limit,
            offset,
            order,
            distinct: true,
            subQuery: false,
            include: [
                ...includesListado(),
                {
                    model: Factura,
                    as: 'factura',
                    attributes: ['id', 'estado', 'numero_factura', 'fecha_emision'],
                    required: false,
                },
                // Sin factura vigente, el listado muestra la última anulada (para volver a emitir)
                {
                    model: Factura,
                    as: 'facturas',
                    attributes: ['id', 'id_venta', 'estado', 'numero_factura', 'fecha_emision'],
                    where: { estado: 'ANULADA' },
                    required: false,
                    separate: true,
                    order: [['fecha_anulacion', 'DESC']],
                },
                {
                    model: PagoVenta,
                    as: 'pagos',
                    attributes: ['id', 'id_venta', 'metodo_pago', 'monto', 'referencia'],
                    separate: true,
                    order: [['orden', 'ASC']],
                },
                {
                    model: Devolucion,
                    as: 'devoluciones',
                    attributes: ['id', 'id_venta_original', 'tipo', 'monto_devuelto', 'monto_diferencia'],
                    where: { estado: 'COMPLETADA', esta_activo: true },
                    required: false,
                    separate: true,
                },
            ],
        }),
        calcularResumenVentas(where),
    ]);

    return {
        ventas: rows.map(ventaListadoDTO),
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
        resumen,
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
        // Total por cada método de pago del SIAT (efectivo neto de cambio)
        totales_por_metodo: Object.fromEntries(METODOS_PAGO_VALIDOS.map((m) => [m, 0])),
        total_descuentos: 0, gran_total: 0,
        cantidad_anuladas: 0,
        // Devoluciones y cambios
        cantidad_devoluciones: 0,
        cantidad_cambios: 0,
        total_reembolsado: 0,
        total_reembolsado_efectivo: 0,
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

        if (v.pagos) {
            v.pagos.forEach(p => {
                if (p.metodo_pago in resumen.totales_por_metodo) {
                    resumen.totales_por_metodo[p.metodo_pago] += parseFloat(p.monto);
                }
            });
        }

        resumen.totales_por_metodo.EFECTIVO -= parseFloat(v.cambio_entregado || 0);
    });

    // Campos legados (compatibilidad con el frontend)
    resumen.total_efectivo = resumen.totales_por_metodo.EFECTIVO;
    resumen.total_qr = resumen.totales_por_metodo.QR;
    resumen.total_tarjeta = resumen.totales_por_metodo.TARJETA;

    // Incluir devoluciones/cambios de esta sesión
    try {
        const { Devolucion } = db;
        if (Devolucion) {
            const devoluciones = await Devolucion.findAll({
                where: { id_sesion_caja, estado: 'COMPLETADA', esta_activo: true },
                attributes: ['tipo', 'monto_devuelto', 'monto_diferencia', 'metodo_reembolso'],
            });

            const reembolsar = (monto, metodo) => {
                resumen.total_reembolsado += monto;
                // Solo el reembolso en efectivo sale de la caja (el crédito queda a favor del cliente)
                if (metodo === 'EFECTIVO') resumen.total_reembolsado_efectivo += monto;
            };

            devoluciones.forEach((d) => {
                const devuelto = parseFloat(d.monto_devuelto);
                const diferencia = parseFloat(d.monto_diferencia);

                if (d.tipo === 'DEVOLUCION') {
                    resumen.cantidad_devoluciones++;
                    reembolsar(devuelto, d.metodo_reembolso);
                } else {
                    resumen.cantidad_cambios++;
                    if (diferencia > 0) {
                        resumen.total_diferencias_cobradas += diferencia;
                    } else if (diferencia < 0) {
                        reembolsar(Math.abs(diferencia), d.metodo_reembolso);
                    }
                }
            });
        }
    } catch (e) {
        console.error('Error obteniendo resumen de devoluciones:', e.message);
    }

    return resumen;
};