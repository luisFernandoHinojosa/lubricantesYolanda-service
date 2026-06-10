import { Op, fn, col, literal } from 'sequelize';
import db from '../../database/index.js';
import {
    parseDateRange, getPeriodoAnterior, calcularVariacion,
    formatCurrency, porcentaje, getGroupByExpression
} from './reportes.helpers.js';

const {
    Venta, DetalleVenta, Compra, DetalleCompra, Movimiento, CategoriaMovimiento,
    Producto, Presentacion, Lote, StockDistribucion, KardexMovimiento,
    SesionCaja, Cliente, Empleado, Sucursal, Ubicacion, Categoria,
    sequelize
} = db;

export const getReporteVentas = async (query = {}) => {
    const { desde, hasta, id_sucursal, id_empleado, metodo_pago, agrupar_por = 'dia' } = query;
    const { start, end } = parseDateRange(desde, hasta);

    const where = { createdAt: { [Op.between]: [start, end] } };
    if (id_sucursal) where.id_sucursal = id_sucursal;
    if (id_empleado) where.id_empleado = id_empleado;
    if (metodo_pago) where.metodo_pago = metodo_pago;

    const stats = await Venta.findOne({
        where,
        attributes: [
            [fn('SUM', col('Venta.total')), 'total_ventas'],
            [fn('COUNT', col('Venta.id')), 'cantidad_ventas'],
            [fn('AVG', col('Venta.total')), 'ticket_promedio'],
            [fn('SUM', col('Venta.monto_descuento_global')), 'total_descuentos'],
            [fn('MAX', col('Venta.total')), 'venta_maxima'],
            [fn('MIN', col('Venta.total')), 'venta_minima'],
        ],
        raw: true,
    });

    const resumen = {
        total_ventas: formatCurrency(stats.total_ventas),
        cantidad_ventas: parseInt(stats.cantidad_ventas) || 0,
        ticket_promedio: formatCurrency(stats.ticket_promedio),
        total_descuentos: formatCurrency(stats.total_descuentos),
        venta_maxima: formatCurrency(stats.venta_maxima),
        venta_minima: formatCurrency(stats.venta_minima),
    };

    const porMetodoPago = await Venta.findAll({
        where,
        attributes: [
            'metodo_pago',
            [fn('SUM', col('Venta.total')), 'total'],
            [fn('COUNT', col('Venta.id')), 'cantidad'],
        ],
        group: ['metodo_pago'],
        raw: true,
    });

    const por_metodo_pago = {};
    porMetodoPago.forEach(r => {
        por_metodo_pago[r.metodo_pago] = {
            total: formatCurrency(r.total),
            cantidad: parseInt(r.cantidad),
            porcentaje: porcentaje(parseFloat(r.total), resumen.total_ventas),
        };
    });

    const [fechaAttr, fechaAlias] = getGroupByExpression(agrupar_por, sequelize);
    const serieRows = await Venta.findAll({
        where,
        attributes: [
            [fechaAttr, fechaAlias],
            [fn('SUM', col('Venta.total')), 'total'],
            [fn('COUNT', col('Venta.id')), 'cantidad'],
        ],
        group: [literal(`"${fechaAlias}"`)],
        order: [[literal(`"${fechaAlias}"`), 'ASC']],
        raw: true,
    });

    const serie_temporal = serieRows.map(r => ({
        fecha: r[fechaAlias] || r.fecha,
        total: formatCurrency(r.total),
        cantidad: parseInt(r.cantidad),
    }));

    const porSucursal = await Venta.findAll({
        where,
        attributes: [
            'id_sucursal',
            [fn('SUM', col('Venta.total')), 'total'],
            [fn('COUNT', col('Venta.id')), 'cantidad'],
        ],
        include: [{ model: Sucursal, as: 'sucursal', attributes: ['nombre'] }],
        group: ['id_sucursal', 'sucursal.id', 'sucursal.nombre'],
        raw: true,
    });

    const por_sucursal = porSucursal.map(r => ({
        id_sucursal: r.id_sucursal,
        sucursal: r['sucursal.nombre'],
        total: formatCurrency(r.total),
        cantidad: parseInt(r.cantidad),
    }));

    const topCajeros = await Venta.findAll({
        where,
        attributes: [
            'id_empleado',
            [fn('SUM', col('Venta.total')), 'total'],
            [fn('COUNT', col('Venta.id')), 'cantidad'],
        ],
        include: [{ model: Empleado, as: 'cajero', attributes: ['nombre', 'apellido_paterno'] }],
        group: ['id_empleado', 'cajero.id', 'cajero.nombre', 'cajero.apellido_paterno'],
        order: [[literal('total'), 'DESC']],
        limit: 10,
        raw: true,
    });

    const top_cajeros = topCajeros.map(r => ({
        empleado: `${r['cajero.nombre']} ${r['cajero.apellido_paterno']}`,
        total: formatCurrency(r.total),
        cantidad: parseInt(r.cantidad),
    }));

    const { start: antStart, end: antEnd } = getPeriodoAnterior(start, end);
    const whereAnterior = { ...where, createdAt: { [Op.between]: [antStart, antEnd] } };
    const anterior = await Venta.findOne({
        where: whereAnterior,
        attributes: [[fn('SUM', col('Venta.total')), 'total']],
        raw: true,
    });

    const comparativa_periodo_anterior = {
        total_actual: resumen.total_ventas,
        total_anterior: formatCurrency(anterior?.total),
        variacion_porcentual: calcularVariacion(resumen.total_ventas, parseFloat(anterior?.total || 0)),
    };

    return { resumen, por_metodo_pago, serie_temporal, por_sucursal, top_cajeros, comparativa_periodo_anterior };
};

export const getReporteCompras = async (query = {}) => {
    const { desde, hasta, id_sucursal, id_proveedor, estado_pago } = query;
    const { start, end } = parseDateRange(desde, hasta);

    const where = { fecha_compra: { [Op.between]: [start, end] } };
    if (id_sucursal) where.id_sucursal = id_sucursal;
    if (id_proveedor) where.id_proveedor = id_proveedor;
    if (estado_pago) where.estado_pago = estado_pago;

    const stats = await Compra.findOne({
        where,
        attributes: [
            [fn('SUM', col('Compra.total')), 'total_compras'],
            [fn('COUNT', col('Compra.id')), 'cantidad_compras'],
            [fn('AVG', col('Compra.total')), 'compra_promedio'],
        ],
        raw: true,
    });

    const pendientes = await Compra.findOne({
        where: { ...where, estado_pago: { [Op.in]: ['PENDIENTE', 'PAGADO_PARCIAL'] } },
        attributes: [[fn('SUM', col('Compra.total')), 'pendientes_pago']],
        raw: true,
    });

    const resumen = {
        total_compras: formatCurrency(stats.total_compras),
        cantidad_compras: parseInt(stats.cantidad_compras) || 0,
        compra_promedio: formatCurrency(stats.compra_promedio),
        pendientes_pago: formatCurrency(pendientes?.pendientes_pago),
    };

    const porProveedor = await Compra.findAll({
        where,
        attributes: ['id_proveedor', [fn('SUM', col('Compra.total')), 'total'], [fn('COUNT', col('Compra.id')), 'cantidad']],
        include: [{ model: db.Proveedor, as: 'proveedor', attributes: ['nombre', 'razon_social'] }],
        group: ['id_proveedor', 'proveedor.id', 'proveedor.nombre', 'proveedor.razon_social'],
        order: [[literal('total'), 'DESC']],
        raw: true,
    });

    const por_proveedor = porProveedor.map(r => ({
        proveedor: r['proveedor.razon_social'] || r['proveedor.nombre'],
        total: formatCurrency(r.total),
        cantidad: parseInt(r.cantidad),
        porcentaje: porcentaje(parseFloat(r.total), resumen.total_compras),
    }));

    const porEstado = await Compra.findAll({
        where,
        attributes: ['estado_pago', [fn('SUM', col('Compra.total')), 'total'], [fn('COUNT', col('Compra.id')), 'cantidad']],
        group: ['estado_pago'],
        raw: true,
    });

    const por_estado_pago = {};
    porEstado.forEach(r => {
        por_estado_pago[r.estado_pago] = { total: formatCurrency(r.total), cantidad: parseInt(r.cantidad) };
    });

    const serieRows = await Compra.findAll({
        where,
        attributes: [
            [fn('DATE', col('Compra.fecha_compra')), 'fecha'],
            [fn('SUM', col('Compra.total')), 'total'],
            [fn('COUNT', col('Compra.id')), 'cantidad'],
        ],
        group: [literal('"fecha"')],
        order: [[literal('"fecha"'), 'ASC']],
        raw: true,
    });

    const serie_temporal = serieRows.map(r => ({
        fecha: r.fecha, total: formatCurrency(r.total), cantidad: parseInt(r.cantidad),
    }));

    const topProductos = await DetalleCompra.findAll({
        attributes: [
            'id_producto',
            [fn('SUM', col('DetalleCompra.cantidad')), 'cantidad_total'],
            [fn('SUM', col('subtotal')), 'costo_total'],
        ],
        include: [
            { model: Compra, as: 'compra', where, attributes: [] },
            { model: Producto, as: 'producto', attributes: ['nombre_comercial'] },
        ],
        group: ['id_producto', 'producto.id', 'producto.nombre_comercial'],
        order: [[literal('"cantidad_total"'), 'DESC']],
        limit: 10,
        raw: true,
    });

    const productos_mas_comprados = topProductos.map(r => ({
        producto: r['producto.nombre_comercial'],
        cantidad_total: formatCurrency(r.cantidad_total),
        costo_total: formatCurrency(r.costo_total),
    }));

    return { resumen, por_proveedor, por_estado_pago, serie_temporal, productos_mas_comprados };
};

export const getReporteInventario = async (query = {}) => {
    const { id_sucursal, id_categoria, estado, solo_vencimiento_proximo } = query;

    const stockInclude = [
        {
            model: Lote, as: 'lote', required: true,
            attributes: ['id', 'codigo_lote', 'costo_compra_unitario', 'fecha_vencimiento', 'fecha_ingreso'],
            include: [{
                model: Producto, as: 'producto', required: true,
                attributes: ['id', 'nombre_comercial', 'stock_minimo', 'id_categoria', 'esta_activo'],
                where: { esta_activo: true },
                ...(id_categoria ? { where: { esta_activo: true, id_categoria } } : {}),
                include: [{ model: Categoria, as: 'categoria', attributes: ['id', 'nombre'] }],
            }],
        },
    ];

    if (id_sucursal) {
        stockInclude.push({
            model: Ubicacion, as: 'ubicacion', required: true,
            where: { id_sucursal },
            attributes: ['id', 'nombre'],
        });
    } else {
        stockInclude.push({ model: Ubicacion, as: 'ubicacion', attributes: ['id', 'nombre'] });
    }

    const allStock = await StockDistribucion.findAll({ include: stockInclude });

    const productoMap = {};
    let valorTotalCosto = 0, valorTotalVenta = 0;

    allStock.forEach(s => {
        const cant = parseFloat(s.cantidad_actual);
        const costo = parseFloat(s.lote?.costo_compra_unitario || 0);
        const precio = parseFloat(s.lote?.precio_venta_sugerido || 0);
        const prod = s.lote?.producto;
        if (!prod) return;

        const valCosto = cant * costo;
        const valVenta = cant * precio;
        valorTotalCosto += valCosto;
        valorTotalVenta += valVenta;

        if (!productoMap[prod.id]) {
            productoMap[prod.id] = {
                id: prod.id,
                nombre: prod.nombre_comercial,
                categoria: prod.categoria?.nombre || 'Sin categoría',
                stock_minimo: parseFloat(prod.stock_minimo),
                stock_actual: 0,
                valor_costo: 0,
                valor_venta: 0,
            };
        }
        productoMap[prod.id].stock_actual += cant;
        productoMap[prod.id].valor_costo += valCosto;
        productoMap[prod.id].valor_venta += valVenta;
    });

    const productos = Object.values(productoMap);
    const totalActivos = productos.length;
    const stockCritico = productos.filter(p => p.stock_actual <= p.stock_minimo && p.stock_actual > 0);
    const sinStock = productos.filter(p => p.stock_actual <= 0);

    const hoy = new Date();
    const en30 = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);
    const lotesPorVencer = await Lote.findAll({
        where: { fecha_vencimiento: { [Op.between]: [hoy, en30] } },
        include: [{ model: Producto, as: 'producto', attributes: ['nombre_comercial'] }],
        order: [['fecha_vencimiento', 'ASC']],
        limit: 20,
    });

    const catMap = {};
    productos.forEach(p => {
        if (!catMap[p.categoria]) catMap[p.categoria] = { productos: 0, valor_costo: 0, valor_venta: 0 };
        catMap[p.categoria].productos++;
        catMap[p.categoria].valor_costo += p.valor_costo;
        catMap[p.categoria].valor_venta += p.valor_venta;
    });

    const resumen = {
        total_productos_activos: totalActivos,
        valor_total_costo: formatCurrency(valorTotalCosto),
        valor_total_venta: formatCurrency(valorTotalVenta),
        margen_bruto_potencial: formatCurrency(valorTotalVenta - valorTotalCosto),
        porcentaje_margen: porcentaje(valorTotalVenta - valorTotalCosto, valorTotalVenta),
        productos_stock_critico: stockCritico.length,
        productos_sin_stock: sinStock.length,
        lotes_por_vencer_30dias: lotesPorVencer.length,
    };

    return {
        resumen,
        por_categoria: Object.entries(catMap).map(([cat, v]) => ({
            categoria: cat, ...v, valor_costo: formatCurrency(v.valor_costo), valor_venta: formatCurrency(v.valor_venta),
        })),
        stock_critico: stockCritico.map(p => ({
            producto: p.nombre, stock_actual: formatCurrency(p.stock_actual),
            stock_minimo: p.stock_minimo, deficit: p.stock_minimo - p.stock_actual,
        })),
        proximos_vencimientos: lotesPorVencer.map(l => ({
            producto: l.producto?.nombre_comercial, lote: l.codigo_lote,
            fecha_vencimiento: l.fecha_vencimiento, cantidad_restante: l.id,
        })),
    };
};

export const getReporteFinanciero = async (query = {}) => {
    const { desde, hasta, id_sucursal } = query;
    const { start, end } = parseDateRange(desde, hasta);

    const whereVentas = { createdAt: { [Op.between]: [start, end] } };
    if (id_sucursal) whereVentas.id_sucursal = id_sucursal;

    const ventasAgg = await Venta.findOne({
        where: whereVentas,
        attributes: [
            [fn('SUM', col('Venta.total')), 'ventas_netas'],
            [fn('SUM', col('Venta.subtotal')), 'ventas_brutas'],
            [fn('SUM', col('Venta.monto_descuento_global')), 'descuentos'],
        ],
        raw: true,
    });

    const ventasBrutas = formatCurrency(ventasAgg?.ventas_brutas);
    const descuentos = formatCurrency(ventasAgg?.descuentos);
    const ventasNetas = formatCurrency(ventasAgg?.ventas_netas);

    const whereMovI = { tipo: 'INGRESO', esta_activo: true, fecha: { [Op.between]: [start, end] } };
    if (id_sucursal) whereMovI.sucursalId = id_sucursal;
    const otrosIngAgg = await Movimiento.findOne({
        where: whereMovI,
        attributes: [[fn('SUM', col('Movimiento.monto')), 'total']],
        raw: true,
    });
    const otrosIngresos = formatCurrency(otrosIngAgg?.total);
    const totalIngresos = formatCurrency(ventasNetas + otrosIngresos);

    const cogsResult = await sequelize.query(`
        SELECT COALESCE(SUM(
            dv."cantidad" * dv."factor_aplicado" * l."costo_compra_unitario"
        ), 0) AS cogs
        FROM "Detalle_Ventas" dv
        JOIN "Ventas" v ON v."id" = dv."id_venta"
        JOIN "KardexMovimientos" km ON km."observacion" LIKE '%' || v."numero_comprobante" || '%'
            AND km."tipo_movimiento" = 'VENTA'
        JOIN "Lotes" l ON l."id" = km."id_lote"
        WHERE v."createdAt" BETWEEN :start AND :end
        ${id_sucursal ? 'AND v."id_sucursal" = :id_sucursal' : ''}
    `, {
        replacements: { start, end, ...(id_sucursal ? { id_sucursal } : {}) },
        type: sequelize.QueryTypes.SELECT,
    });

    let cogs = parseFloat(cogsResult?.[0]?.cogs || 0);
    if (cogs === 0) {
        const ventasDetalle = await DetalleVenta.findAll({
            include: [{ model: Venta, as: 'venta', where: whereVentas, attributes: [] }],
            attributes: ['id_producto', 'cantidad', 'factor_aplicado'],
            raw: true,
        });
        for (const det of ventasDetalle) {
            const lote = await Lote.findOne({
                where: { id_producto: det.id_producto },
                order: [['fecha_ingreso', 'ASC']],
                attributes: ['costo_compra_unitario'],
            });
            if (lote) {
                cogs += parseFloat(det.cantidad) * parseFloat(det.factor_aplicado) * parseFloat(lote.costo_compra_unitario);
            }
        }
    }
    cogs = formatCurrency(cogs);
    const utilidadBruta = formatCurrency(totalIngresos - cogs);

    const whereMovE = { tipo: 'EGRESO', esta_activo: true, fecha: { [Op.between]: [start, end] } };
    if (id_sucursal) whereMovE.sucursalId = id_sucursal;

    const gastosRows = await Movimiento.findAll({
        where: whereMovE,
        attributes: ['categoriaMovimientoId', [fn('SUM', col('Movimiento.monto')), 'total']],
        include: [{ model: CategoriaMovimiento, as: 'categoria_movimiento', attributes: ['nombre'] }],
        group: ['categoriaMovimientoId', 'categoria_movimiento.id', 'categoria_movimiento.nombre'],
        raw: true,
    });

    const gastosPorCat = gastosRows.map(r => ({
        categoria: r['categoria_movimiento.nombre'],
        monto: formatCurrency(r.total),
    }));
    const totalGastosOp = gastosPorCat.reduce((acc, g) => acc + g.monto, 0);

    const empleadosWhere = { esta_activo: true };
    const nomina = await Empleado.findOne({
        where: empleadosWhere,
        attributes: [[fn('SUM', col('salario_base')), 'total_salarios']],
        raw: true,
    });
    const costaNominaMensual = formatCurrency(nomina?.total_salarios);

    const utilidadOperativa = formatCurrency(utilidadBruta - totalGastosOp);

    const flujoIngresos = await Venta.findAll({
        where: whereVentas,
        attributes: ['metodo_pago', [fn('SUM', col('Venta.total')), 'total']],
        group: ['metodo_pago'], raw: true,
    });

    const flujoEgresos = await Movimiento.findAll({
        where: whereMovE,
        attributes: ['tipoPago', [fn('SUM', col('Movimiento.monto')), 'total']],
        group: ['tipoPago'], raw: true,
    });

    const flujoCaja = {};
    flujoIngresos.forEach(r => {
        if (!flujoCaja[r.metodo_pago]) flujoCaja[r.metodo_pago] = { ingresos: 0, egresos: 0 };
        flujoCaja[r.metodo_pago].ingresos = formatCurrency(r.total);
    });
    flujoEgresos.forEach(r => {
        const key = r.tipoPago;
        if (!flujoCaja[key]) flujoCaja[key] = { ingresos: 0, egresos: 0 };
        flujoCaja[key].egresos = formatCurrency(r.total);
    });
    Object.keys(flujoCaja).forEach(k => {
        flujoCaja[k].neto = formatCurrency(flujoCaja[k].ingresos - flujoCaja[k].egresos);
    });

    const serieMensual = await Venta.findAll({
        where: whereVentas,
        attributes: [
            [fn('DATE_TRUNC', 'month', col('createdAt')), 'mes'],
            [fn('SUM', col('Venta.total')), 'ingresos'],
        ],
        group: [literal('"mes"')],
        order: [[literal('"mes"'), 'ASC']],
        raw: true,
    });

    return {
        estado_resultados: {
            ingresos: {
                ventas_brutas: ventasBrutas,
                descuentos_otorgados: descuentos,
                ventas_netas: ventasNetas,
                otros_ingresos: otrosIngresos,
                total_ingresos: totalIngresos,
            },
            costos: { costo_mercaderia_vendida: cogs, total_costos: cogs },
            utilidad_bruta: utilidadBruta,
            margen_bruto_porcentaje: porcentaje(utilidadBruta, totalIngresos),
            gastos_operativos: { por_categoria: gastosPorCat, total_gastos_operativos: formatCurrency(totalGastosOp) },
            utilidad_operativa: utilidadOperativa,
            margen_operativo_porcentaje: porcentaje(utilidadOperativa, totalIngresos),
            costo_nomina_mensual: costaNominaMensual,
        },
        flujo_caja: {
            por_metodo_pago: flujoCaja,
            total_ingresado: totalIngresos,
            total_egresado: formatCurrency(cogs + totalGastosOp),
            flujo_neto: utilidadOperativa,
        },
        serie_temporal_mensual: serieMensual.map(r => ({ mes: r.mes, ingresos: formatCurrency(r.ingresos) })),
    };
};

export const getReporteSesionesCaja = async (query = {}) => {
    const { desde, hasta, id_sucursal, id_empleado } = query;
    const { start, end } = parseDateRange(desde, hasta);

    const where = { fecha_apertura: { [Op.between]: [start, end] } };
    if (id_sucursal) where.id_sucursal = id_sucursal;
    if (id_empleado) where.id_empleado = id_empleado;

    const sesiones = await SesionCaja.findAll({
        where,
        include: [
            { model: Empleado, as: 'empleado', attributes: ['id', 'nombre', 'apellido_paterno'] },
            { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] },
        ],
        order: [['fecha_apertura', 'DESC']],
    });

    let totalDiferencia = 0, sesionesConDif = 0, totalDuracionMs = 0, cerradas = 0;

    const detalle_sesiones = [];
    const empleadoMap = {};

    for (const s of sesiones) {
        const apertura = parseFloat(s.monto_apertura || 0);
        const teorico = parseFloat(s.monto_teorico || 0);
        const cierre = parseFloat(s.monto_cierre || 0);
        const diferencia = s.estado === 'CERRADA' ? formatCurrency(cierre - teorico) : null;

        if (diferencia !== null && diferencia !== 0) { sesionesConDif++; totalDiferencia += diferencia; }

        const ventaCount = await Venta.count({ where: { id_sesion_caja: s.id } });
        const ventaSum = await Venta.findOne({
            where: { id_sesion_caja: s.id },
            attributes: [[fn('SUM', col('Venta.total')), 'total']],
            raw: true,
        });

        let duracion = null;
        if (s.fecha_cierre && s.fecha_apertura) {
            duracion = formatCurrency((new Date(s.fecha_cierre) - new Date(s.fecha_apertura)) / 3600000);
            totalDuracionMs += (new Date(s.fecha_cierre) - new Date(s.fecha_apertura));
            cerradas++;
        }

        const empName = `${s.empleado?.nombre || ''} ${s.empleado?.apellido_paterno || ''}`.trim();

        detalle_sesiones.push({
            id: s.id,
            fecha: s.fecha_apertura,
            empleado: empName,
            sucursal: s.sucursal?.nombre,
            estado: s.estado,
            monto_apertura: apertura,
            monto_teorico: teorico,
            monto_cierre: cierre,
            diferencia,
            cantidad_ventas: ventaCount,
            total_ventas: formatCurrency(ventaSum?.total),
            duracion_horas: duracion,
        });

        if (!empleadoMap[s.id_empleado]) {
            empleadoMap[s.id_empleado] = { empleado: empName, sesiones: 0, total_ventas: 0, diferencia_acumulada: 0 };
        }
        empleadoMap[s.id_empleado].sesiones++;
        empleadoMap[s.id_empleado].total_ventas += formatCurrency(ventaSum?.total);
        if (diferencia !== null) empleadoMap[s.id_empleado].diferencia_acumulada += diferencia;
    }

    return {
        resumen: {
            total_sesiones: sesiones.length,
            sesiones_con_diferencia: sesionesConDif,
            diferencia_total_acumulada: formatCurrency(totalDiferencia),
            promedio_duracion_horas: cerradas > 0 ? formatCurrency(totalDuracionMs / cerradas / 3600000) : 0,
        },
        por_empleado: Object.values(empleadoMap).map(e => ({
            ...e,
            total_ventas: formatCurrency(e.total_ventas),
            diferencia_acumulada: formatCurrency(e.diferencia_acumulada),
        })),
        detalle_sesiones,
    };
};

export const getReporteProductos = async (query = {}) => {
    const { desde, hasta, id_sucursal, id_categoria, top_n = 20 } = query;
    const { start, end } = parseDateRange(desde, hasta);
    const whereVenta = { createdAt: { [Op.between]: [start, end] } };
    if (id_sucursal) whereVenta.id_sucursal = id_sucursal;

    const topVendidos = await DetalleVenta.findAll({
        attributes: [
            'id_producto',
            [fn('SUM', col('DetalleVenta.cantidad')), 'cantidad_vendida'],
            [fn('SUM', col('DetalleVenta.subtotal')), 'ingresos'],
        ],
        include: [
            { model: Venta, as: 'venta', where: whereVenta, attributes: [] },
            {
                model: Producto, as: 'producto',
                attributes: ['nombre_comercial', 'id_categoria'],
                ...(id_categoria ? { where: { id_categoria } } : {}),
            },
        ],
        group: ['id_producto', 'producto.id', 'producto.nombre_comercial', 'producto.id_categoria'],
        order: [[literal('"ingresos"'), 'DESC']],
        limit: parseInt(top_n),
        raw: true,
    });

    const mas_vendidos = [];
    for (const r of topVendidos) {
        const lote = await Lote.findOne({
            where: { id_producto: r.id_producto },
            order: [['fecha_ingreso', 'DESC']],
            attributes: ['costo_compra_unitario'],
        });
        const costo = parseFloat(lote?.costo_compra_unitario || 0);
        const cantVendida = parseFloat(r.cantidad_vendida);
        const ingresos = parseFloat(r.ingresos);
        const costoTotal = costo * cantVendida;
        const margen = ingresos - costoTotal;

        mas_vendidos.push({
            producto: r['producto.nombre_comercial'],
            cantidad_vendida: formatCurrency(cantVendida),
            ingresos: formatCurrency(ingresos),
            margen: formatCurrency(margen),
            margen_porcentaje: porcentaje(margen, ingresos),
        });
    }

    const menosVendidos = await DetalleVenta.findAll({
        attributes: [
            'id_producto',
            [fn('SUM', col('DetalleVenta.cantidad')), 'cantidad_vendida'],
            [fn('SUM', col('DetalleVenta.subtotal')), 'ingresos'],
        ],
        include: [
            { model: Venta, as: 'venta', where: whereVenta, attributes: [] },
            { model: Producto, as: 'producto', attributes: ['nombre_comercial'] },
        ],
        group: ['id_producto', 'producto.id', 'producto.nombre_comercial'],
        order: [[literal('"ingresos"'), 'ASC']],
        limit: 10,
        raw: true,
    });

    const menos_vendidos = menosVendidos.map(r => ({
        producto: r['producto.nombre_comercial'],
        cantidad_vendida: formatCurrency(r.cantidad_vendida),
        ingresos: formatCurrency(r.ingresos),
    }));

    const productosConVenta = topVendidos.map(r => r.id_producto);
    const sinMovWhere = { esta_activo: true };
    if (id_categoria) sinMovWhere.id_categoria = id_categoria;

    const sinMov = await Producto.findAll({
        where: {
            ...sinMovWhere,
            ...(productosConVenta.length > 0 ? { id: { [Op.notIn]: productosConVenta } } : {}),
        },
        attributes: ['id', 'nombre_comercial'],
        limit: 20,
    });

    const sin_movimiento = sinMov.map(p => ({ producto: p.nombre_comercial, id: p.id }));

    const totalIngresos = mas_vendidos.reduce((acc, p) => acc + p.ingresos, 0);
    let acumulado = 0;
    const abc = { A: { productos: 0, porcentaje_ventas: 0 }, B: { productos: 0, porcentaje_ventas: 0 }, C: { productos: 0, porcentaje_ventas: 0 } };

    mas_vendidos.forEach(p => {
        acumulado += p.ingresos;
        const pctAcum = porcentaje(acumulado, totalIngresos);
        if (pctAcum <= 80) { abc.A.productos++; abc.A.porcentaje_ventas += porcentaje(p.ingresos, totalIngresos); }
        else if (pctAcum <= 95) { abc.B.productos++; abc.B.porcentaje_ventas += porcentaje(p.ingresos, totalIngresos); }
        else { abc.C.productos++; abc.C.porcentaje_ventas += porcentaje(p.ingresos, totalIngresos); }
    });

    abc.A.porcentaje_ventas = formatCurrency(abc.A.porcentaje_ventas);
    abc.B.porcentaje_ventas = formatCurrency(abc.B.porcentaje_ventas);
    abc.C.porcentaje_ventas = formatCurrency(abc.C.porcentaje_ventas);

    return { mas_vendidos, menos_vendidos, sin_movimiento, analisis_abc: abc };
};

export const getReporteClientes = async (query = {}) => {
    const { desde, hasta, top_n = 15, tipo_cliente } = query;
    const { start, end } = parseDateRange(desde, hasta);

    const whereVenta = { createdAt: { [Op.between]: [start, end] } };

    const clienteWhere = { esta_activo: true };
    if (tipo_cliente) clienteWhere.tipo_cliente = tipo_cliente;

    const totalActivos = await Cliente.count({ where: clienteWhere });
    const clientesNuevos = await Cliente.count({
        where: { ...clienteWhere, createdAt: { [Op.between]: [start, end] } },
    });
    const mayoristas = await Cliente.count({ where: { ...clienteWhere, tipo_cliente: 'MAY' } });
    const minoristas = await Cliente.count({ where: { ...clienteWhere, tipo_cliente: 'MIN' } });

    const topClientes = await Venta.findAll({
        where: whereVenta,
        attributes: [
            'id_cliente',
            [fn('SUM', col('Venta.total')), 'total_compras'],
            [fn('COUNT', col('Venta.id')), 'cantidad_ventas'],
        ],
        include: [{
            model: Cliente, as: 'cliente',
            attributes: ['nombre', 'apellido_paterno', 'ci', 'puntos', 'tipo_cliente'],
            ...(tipo_cliente ? { where: { tipo_cliente } } : {}),
        }],
        group: ['id_cliente', 'cliente.id', 'cliente.nombre', 'cliente.apellido_paterno', 'cliente.ci', 'cliente.puntos', 'cliente.tipo_cliente'],
        order: [[literal('"total_compras"'), 'DESC']],
        limit: parseInt(top_n),
        raw: true,
    });

    const top_clientes = topClientes.map(r => ({
        cliente: `${r['cliente.nombre']} ${r['cliente.apellido_paterno'] || ''}`.trim(),
        ci: r['cliente.ci'],
        tipo: r['cliente.tipo_cliente'],
        total_compras: formatCurrency(r.total_compras),
        cantidad_ventas: parseInt(r.cantidad_ventas),
        puntos: parseInt(r['cliente.puntos'] || 0),
    }));

    const recurrentes = await Venta.findAll({
        where: whereVenta,
        attributes: ['id_cliente', [fn('COUNT', col('Venta.id')), 'veces']],
        group: ['id_cliente'],
        having: literal('COUNT("Venta"."id") > 1'),
        raw: true,
    });

    return {
        resumen: {
            total_clientes_activos: totalActivos,
            clientes_nuevos_periodo: clientesNuevos,
            clientes_recurrentes: recurrentes.length,
            clientes_mayoristas: mayoristas,
            clientes_minoristas: minoristas,
        },
        top_clientes,
    };
};

export const getReporteEmpleados = async (query = {}) => {
    const { desde, hasta, id_sucursal } = query;
    const { start, end } = parseDateRange(desde, hasta);

    const empWhere = { esta_activo: true };
    const totalActivos = await Empleado.count({ where: empWhere });
    const nominaAgg = await Empleado.findOne({
        where: empWhere,
        attributes: [
            [fn('SUM', col('salario_base')), 'total_nomina'],
            [fn('AVG', col('salario_base')), 'promedio_salario'],
        ],
        raw: true,
    });

    const resumen = {
        total_empleados_activos: totalActivos,
        costo_nomina_mensual: formatCurrency(nominaAgg?.total_nomina),
        promedio_salario: formatCurrency(nominaAgg?.promedio_salario),
    };

    const whereVenta = { createdAt: { [Op.between]: [start, end] } };
    if (id_sucursal) whereVenta.id_sucursal = id_sucursal;

    const rendimiento = await Venta.findAll({
        where: whereVenta,
        attributes: [
            'id_empleado',
            [fn('SUM', col('Venta.total')), 'ventas_total'],
            [fn('COUNT', col('Venta.id')), 'cantidad_ventas'],
            [fn('AVG', col('Venta.total')), 'ticket_promedio'],
        ],
        include: [{ model: Empleado, as: 'cajero', attributes: ['nombre', 'apellido_paterno', 'cargo'] }],
        group: ['id_empleado', 'cajero.id', 'cajero.nombre', 'cajero.apellido_paterno', 'cajero.cargo'],
        order: [[literal('"ventas_total"'), 'DESC']],
        raw: true,
    });

    const rendimiento_ventas = rendimiento.map(r => ({
        empleado: `${r['cajero.nombre']} ${r['cajero.apellido_paterno'] || ''}`.trim(),
        cargo: r['cajero.cargo'] || 'N/A',
        ventas_total: formatCurrency(r.ventas_total),
        cantidad_ventas: parseInt(r.cantidad_ventas),
        ticket_promedio: formatCurrency(r.ticket_promedio),
    }));

    const productividad = [];
    for (const emp of rendimiento) {
        const sesionesCount = await SesionCaja.count({
            where: {
                id_empleado: emp.id_empleado,
                estado: 'CERRADA',
                fecha_apertura: { [Op.between]: [start, end] },
            },
        });

        const totalHoras = await SesionCaja.findAll({
            where: {
                id_empleado: emp.id_empleado,
                estado: 'CERRADA',
                fecha_apertura: { [Op.between]: [start, end] },
            },
            attributes: ['fecha_apertura', 'fecha_cierre'],
        });

        let horasTrabajadas = 0;
        totalHoras.forEach(s => {
            if (s.fecha_cierre && s.fecha_apertura) {
                horasTrabajadas += (new Date(s.fecha_cierre) - new Date(s.fecha_apertura)) / 3600000;
            }
        });

        productividad.push({
            empleado: `${emp['cajero.nombre']} ${emp['cajero.apellido_paterno'] || ''}`.trim(),
            sesiones_trabajadas: sesionesCount,
            horas_trabajadas: formatCurrency(horasTrabajadas),
            ventas_por_hora: horasTrabajadas > 0 ? formatCurrency(parseFloat(emp.ventas_total) / horasTrabajadas) : 0,
            ventas_por_sesion: sesionesCount > 0 ? formatCurrency(parseFloat(emp.ventas_total) / sesionesCount) : 0,
        });
    }

    return { resumen, rendimiento_ventas, productividad };
};
