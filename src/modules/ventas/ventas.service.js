import { Op } from 'sequelize';
import db from '../../database/index.js';
import { VENTA_CONFIG } from '../../common/applyFilters.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { emitirFactura, siguienteNumeroFactura } from './facturacion.service.js';
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

// Stock disponible en la sucursal de todos los productos, en una sola consulta.
// Retorna Map<id_producto, registros[]> en orden FIFO (lote más antiguo primero).
const cargarStockFIFO = async (idsProducto, id_sucursal, transaction) => {
    const registros = await StockDistribucion.findAll({
        where: { cantidad_actual: { [Op.gt]: 0 } },
        include: [
            {
                model: Lote,
                as: 'lote',
                where: { id_producto: idsProducto },
                attributes: ['id', 'id_producto', 'fecha_ingreso'],
                required: true,
            },
            {
                model: Ubicacion,
                as: 'ubicacion',
                where: { id_sucursal },
                attributes: [],
                required: true,
            },
        ],
        order: [[{ model: Lote, as: 'lote' }, 'fecha_ingreso', 'ASC'], ['id', 'ASC']],
        // OF: bloquea solo las filas de stock; sin OF también se bloquearían Lote y Ubicacion
        lock: { level: transaction.LOCK.UPDATE, of: StockDistribucion },
        transaction,
    });

    const porProducto = new Map(idsProducto.map((id) => [id, []]));
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
        attributes: ['id', 'nombre_comercial', 'codigo_barras', 'precio_venta'],
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
    const stockPorProducto = await cargarStockFIFO(idsProducto, id_sucursal, transaction);

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

// ─── Facturar una venta registrada sin factura ───────────────────────────────
// Se factura con los detalles, pagos y cliente guardados en la venta. El recargo
// (en Bs) se registra una sola vez, junto con la factura: después la venta ya no
// puede volver a facturarse. Igual que en crearVenta, no va en la factura ni suma
// puntos de lealtad, y no se registra como un pago.
export const facturarVenta = async ({ id_venta, monto_recargo_iva = 0, name_user }) => {
    const montoRecargo = redondear2(parseFloat(monto_recargo_iva) || 0);

    await sequelize.transaction(async (t) => {
        // Bloquea la venta para que dos solicitudes simultáneas no la facturen dos veces
        const venta = await Venta.findByPk(id_venta, {
            include: [
                { model: Cliente, as: 'cliente', attributes: ['id', 'ci'] },
                { model: Factura, as: 'factura', attributes: ['id', 'estado', 'numero_factura'] },
            ],
            lock: { level: t.LOCK.UPDATE, of: Venta },
            transaction: t,
        });

        if (!venta) {
            throw new NotFoundError('Venta', 'Venta no encontrada.');
        }

        if (!venta.esta_activo) {
            throw new ConflictError('No se puede facturar una venta anulada.');
        }

        if (venta.factura) {
            throw new ConflictError(
                venta.factura.estado === 'FACTURADA'
                    ? `La venta ${venta.numero_comprobante} ya fue facturada (factura N° ${venta.factura.numero_factura}).`
                    : `La venta ${venta.numero_comprobante} ya tiene la factura N° ${venta.factura.numero_factura} ` +
                      `en estado ${venta.factura.estado}. Use la opción de reintentar factura.`
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
            transaction: t,
        });
        if (devoluciones > 0) {
            throw new BusinessRuleError(
                'No se puede facturar una venta con devoluciones o cambios registrados.',
                'VENTA_CON_DEVOLUCIONES'
            );
        }

        if (montoRecargo > 0) {
            const totalSinRecargo = redondear2(parseFloat(venta.total) - parseFloat(venta.monto_recargo_iva || 0));
            const porcentajeRecargo = totalSinRecargo > 0 ? redondear2((montoRecargo * 100) / totalSinRecargo) : 0;
            if (porcentajeRecargo > 100) {
                throw new BusinessRuleError(
                    `El recargo por factura (Bs ${montoRecargo.toFixed(2)}) no puede superar ` +
                    `el total de la venta (Bs ${totalSinRecargo.toFixed(2)}).`
                );
            }

            // `total` incluye el recargo (ver Venta): emitirFactura lo resta para obtener
            // el monto que va al SIAT, por eso se actualiza junto con el recargo.
            await venta.update({
                porcentaje_recargo_iva: porcentajeRecargo.toFixed(2),
                monto_recargo_iva: montoRecargo.toFixed(2),
                total: redondear2(totalSinRecargo + montoRecargo).toFixed(2),
            }, { transaction: t });
        }

        // Último paso, como en crearVenta, para no consumir números de la secuencia si algo falla
        await Factura.create({
            id_venta: venta.id,
            estado: 'PENDIENTE',
            numero_factura: await siguienteNumeroFactura(t),
        }, { transaction: t });
    });

    // ── Facturación (fuera de la transacción DB, la factura PENDIENTE ya está registrada) ──
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

export const anularVenta = async (id_venta, id_usuario) => {
    const empleado = await Empleado.findOne({ where: { usuario_id: id_usuario } });
    if (!empleado) {
        throw new ForbiddenError('El usuario no tiene un empleado asociado.');
    }

    const venta = await Venta.findByPk(id_venta, {
        include: [
            { model: DetalleVenta, as: 'detalles' },
            { model: Cliente, as: 'cliente' },
        ],
    });

    if (!venta) {
        throw new NotFoundError('Venta', 'Venta no encontrada.');
    }

    if (!venta.esta_activo) {
        throw new ConflictError('La venta ya se encuentra anulada.');
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
            const totalVenta = parseFloat(venta.total);
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