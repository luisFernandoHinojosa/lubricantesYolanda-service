import db from '../../database/index.js';
import { Op, fn, col } from 'sequelize';
import moment from 'moment';

const { KardexMovimiento, Lote, Cliente, Producto, StockDistribucion, Usuario, Venta } = db;

export const getResumen = async () => {
    const today = moment().startOf('day').toDate();
    const tomorrow = moment(today).add(1, 'days').toDate();

    const totalVentasDia = await Venta.sum('total', {
        where: {
            createdAt: {
                [Op.gte]: today,
                [Op.lt]: tomorrow
            }
        }
    });

    const stockAll = await StockDistribucion.findAll({
        include: [{
            model: Lote,
            as: 'lote',
            attributes: ['costo_compra_unitario']
        }]
    });

    const totalClientes = await Cliente.count({
        where: {
            ci: {
                [Op.ne]: '000000'
            }
        }
    });
    const inventarioValorizado = stockAll.reduce((acc, current) => {
        const cantidad = parseFloat(current.cantidad_actual) || 0;
        const costo = parseFloat(current.lote?.costo_compra_unitario) || 0;
        return acc + (cantidad * costo);
    }, 0);

    const totalUsuarios = await Usuario.count();
    const cuentasPorCobrar = 0;
    const pedidosPendientes = 0;

    return {
        ventasDelDia: totalVentasDia || 0,
        cuentasPorCobrar: 0,
        inventarioValorizado: inventarioValorizado || 0,
        pedidosPendientes: 0,
        resumenUsuarios: {
            administradores: Math.max(1, Math.floor(totalUsuarios * 0.1)),
            clientes: totalClientes,
            empleados: Math.max(1, Math.floor(totalUsuarios * 0.9))
        }
    };
};

export const getChartData = async (filtro) => {
    const today = moment().endOf('day').toDate();
    let startDate;

    if (filtro === 'semana') startDate = moment().startOf('week').toDate();
    else if (filtro === 'mes') startDate = moment().startOf('month').toDate();
    else startDate = moment().subtract(10, 'years').startOf('year').toDate();

    const movimientos = await KardexMovimiento.findAll({
        where: {
            fecha: { [Op.between]: [startDate, today] }
        },
        include: [{
            model: Lote,
            as: 'lote',
            attributes: ['costo_compra_unitario'],
            include: [{
                model: Producto,
                as: 'producto',
                attributes: ['precio_venta']
            }]
        }]
    });

    let ingresos = Array(12).fill(0);
    let egresos = Array(12).fill(0);
    let totales = { ingresos: 0, egresos: 0 };

    movimientos.forEach(m => {
        const monthIndex = moment(m.fecha).month();
        const qty = parseFloat(m.cantidad);

        if (m.tipo_movimiento === 'VENTA') {
            const precio = parseFloat(m.lote?.producto?.precio_venta || 0);
            const total = qty * precio;
            ingresos[monthIndex] += total;
            totales.ingresos += total;
        } else if (m.tipo_movimiento === 'INGRESO') {
            const costo = parseFloat(m.lote?.costo_compra_unitario || 0);
            const total = qty * costo;
            egresos[monthIndex] += total;
            totales.egresos += total;
        }
    });

    let saldoAcumuladoLinea = Array(12).fill(0);
    let currentSald = 0;
    for (let i = 0; i < 12; i++) {
        currentSald += (ingresos[i] - egresos[i]);
        saldoAcumuladoLinea[i] = currentSald;
    }

    return {
        labels: ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'],
        totales: {
            saldo_inicial: 0,
            ingresos: totales.ingresos,
            egresos: totales.egresos,
            saldo_acumulado: totales.ingresos - totales.egresos
        },
        datasets: { ingresos, egresos, saldo_acumulado: saldoAcumuladoLinea }
    };
};

export const getClientesTop = async () => {
    const clientes = await Cliente.findAll({
        where: {
            esta_activo: true,
            ci: { [Op.ne]: '000000' }
        },
        order: [['puntos', 'DESC']],
        limit: 10,
        attributes: ['id', 'nombre', 'apellido_paterno', 'ci', 'puntos']
    });
    return clientes;
};

export const getProductosStock = async () => {
    const stock = await StockDistribucion.findAll({
        limit: 8,
        include: [{
            model: Lote,
            as: 'lote',
            include: [{
                model: Producto,
                as: 'producto',
                attributes: ['nombre_comercial', 'stock_minimo']
            }]
        }]
    });

    return stock.map(s => ({
        id: s.id,
        nombre: s.lote?.producto?.nombre_comercial || 'Desconocido',
        stock_minimo: s.lote?.producto?.stock_minimo || 0,
        cantidad_actual: s.cantidad_actual || 0,
        estado: parseFloat(s.cantidad_actual) <= parseFloat(s.lote?.producto?.stock_minimo || 0) ? 'Crítico' : 'Normal'
    }));
};

export const getUltimosMovimientos = async () => {
    const movimientos = await KardexMovimiento.findAll({
        order: [['fecha', 'DESC']],
        limit: 8,
        include: [{
            model: Lote,
            as: 'lote',
            attributes: ['costo_compra_unitario'],
            include: [{
                model: Producto,
                as: 'producto',
                attributes: ['nombre_comercial', 'precio_venta']
            }]
        }]
    });

    return movimientos.map((m, i) => {
        const esVenta = m.tipo_movimiento === 'VENTA';
        const precioDeReferencia = esVenta
            ? parseFloat(m.lote?.producto?.precio_venta || 0)
            : parseFloat(m.lote?.costo_compra_unitario || 0);

        return {
            id: m.id,
            numero: `#102${i + 1}`,
            cliente_proveedor: m.lote?.producto?.nombre_comercial || 'Varios',
            monto: parseFloat(m.cantidad) * precioDeReferencia,
            estado: 'Registrado'
        };
    });
};

export const getCobranzasPendientes = async () => {
    return [];
};

export const getProductosMasVendidos = async () => {
    const movimientosVenta = await KardexMovimiento.findAll({
        where: { tipo_movimiento: 'VENTA' },
        include: [{
            model: Lote,
            as: 'lote',
            include: [{
                model: Producto,
                as: 'producto',
                attributes: ['nombre_comercial']
            }]
        }]
    });

    const counts = {};
    movimientosVenta.forEach(m => {
        const nombre = m.lote?.producto?.nombre_comercial;
        if (nombre) {
            counts[nombre] = (counts[nombre] || 0) + parseFloat(m.cantidad);
        }
    });

    const result = Object.entries(counts)
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);

    return result;
};

export const getProductosPorVencer = async () => {
    const thirtyDaysFromNow = moment().add(30, 'days').toDate();
    const hoy = moment().startOf('day').toDate();

    const lotes = await Lote.findAll({
        where: {
            fecha_vencimiento: {
                [Op.between]: [hoy, thirtyDaysFromNow]
            }
        },
        include: [{
            model: Producto,
            as: 'producto',
            attributes: ['nombre_comercial']
        }],
        order: [['fecha_vencimiento', 'ASC']],
        limit: 5
    });

    return lotes.map(l => ({
        nombre: l.producto?.nombre_comercial || 'Lote desc.',
        fecha: l.fecha_vencimiento
    }));
};

