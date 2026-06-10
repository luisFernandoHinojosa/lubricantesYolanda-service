import { Op } from 'sequelize';
import db from '../../database/index.js';

const { SesionCaja, Venta, Usuario, Sucursal, Cliente, Empleado, sequelize } = db;

// ─── ABRIR SESIÓN ────────────────────────────────────────────────────────────
export const abrirSesion = async ({ id_sucursal, id_usuario, monto_apertura }) => {
    const empleado = await Empleado.findOne({ where: { usuario_id: id_usuario } });
    if (!empleado) {
        const err = new Error('El usuario no tiene un empleado asociado.');
        err.statusCode = 400;
        throw err;
    }
    const id_empleado = empleado.id;

    // Verificar que el cajero no tenga ya una sesión abierta hoy
    const sesionActiva = await SesionCaja.findOne({
        where: {
            id_empleado,
            id_sucursal,
            estado: 'ABIERTA',
        },
    });

    if (sesionActiva) {
        const err = new Error('El cajero ya tiene una sesión de caja abierta.');
        err.statusCode = 409;
        throw err;
    }

    const sesion = await SesionCaja.create({
        id_sucursal,
        id_empleado,
        monto_apertura,
        estado: 'ABIERTA',
        fecha_apertura: new Date(),
    });

    return sesion;
};

// ─── OBTENER SESIÓN ACTIVA ───────────────────────────────────────────────────
export const getSesionActiva = async ({ id_usuario, id_sucursal }) => {
    const empleado = await Empleado.findOne({ where: { usuario_id: id_usuario } });
    if (!empleado) {
        const err = new Error('El usuario no tiene un empleado asociado.');
        err.statusCode = 400;
        throw err;
    }
    const id_empleado = empleado.id;

    const sesion = await SesionCaja.findOne({
        where: { id_empleado, id_sucursal, estado: 'ABIERTA' },
        include: [
            {
                model: Sucursal,
                as: 'sucursal',
                attributes: ['id', 'nombre', 'direccion', 'responsable']
            },
            {
                model: Empleado,
                as: 'empleado',
                attributes: ['id', 'nombre', 'apellido_paterno', 'apellido_materno']
            },
        ],
    });

    if (!sesion) {
        const err = new Error('No hay sesión de caja abierta.');
        err.statusCode = 404;
        throw err;
    }
    return sesion;
};

// ─── CALCULAR TOTALES DE LA SESIÓN ──────────────────────────────────────────
const calcularTotalesSesion = async (id_sesion_caja) => {
    const ventas = await Venta.findAll({
        where: { id_sesion_caja },
        attributes: ['metodo_pago', 'total'],
    });

    const ventasEfectivo = ventas
        .filter((v) => v.metodo_pago === 'EFECTIVO')
        .reduce((acc, v) => acc + parseFloat(v.total), 0);

    const ventasDigital = ventas
        .filter((v) => v.metodo_pago !== 'EFECTIVO')
        .reduce((acc, v) => acc + parseFloat(v.total), 0);

    const totalVentas = ventasEfectivo + ventasDigital;

    return { ventasEfectivo, ventasDigital, totalVentas, cantidadVentas: ventas.length };
};

// ─── CERRAR SESIÓN (ARQUEO) ──────────────────────────────────────────────────
export const cerrarSesion = async ({ id_sesion, id_usuario, monto_cierre }) => {
    const empleado = await Empleado.findOne({ where: { usuario_id: id_usuario } });
    if (!empleado) {
        const err = new Error('El usuario no tiene un empleado asociado.');
        err.statusCode = 400;
        throw err;
    }
    const id_empleado = empleado.id;

    const sesion = await SesionCaja.findOne({
        where: { id: id_sesion, id_empleado, estado: 'ABIERTA' },
    });

    if (!sesion) {
        const err = new Error('Sesión no encontrada o ya fue cerrada.');
        err.statusCode = 404;
        throw err;
    }

    const { ventasEfectivo, ventasDigital, totalVentas, cantidadVentas } =
        await calcularTotalesSesion(id_sesion);

    // Efectivo teórico = monto apertura + ventas en efectivo del turno
    const monto_teorico = parseFloat(sesion.monto_apertura) + ventasEfectivo;
    const diferencia = parseFloat(monto_cierre) - monto_teorico;

    await sesion.update({
        monto_cierre: parseFloat(monto_cierre),
        monto_teorico,
        estado: 'CERRADA',
        fecha_cierre: new Date(),
    });

    return {
        sesion,
        resumen: {
            monto_apertura: parseFloat(sesion.monto_apertura),
            ventas_efectivo: ventasEfectivo,
            ventas_digital: ventasDigital,
            total_ventas: totalVentas,
            cantidad_ventas: cantidadVentas,
            monto_teorico,
            monto_cierre: parseFloat(monto_cierre),
            diferencia,
        },
    };
};

// ─── HISTORIAL DE SESIONES ───────────────────────────────────────────────────
export const getHistorialSesiones = async ({ id_sucursal, id_usuario, desde, hasta, page = 1, limit = 20 }) => {
    const where = { id_sucursal };
    if (id_usuario) {
        const empleado = await Empleado.findOne({ where: { usuario_id: id_usuario } });
        if (empleado) {
            where.id_empleado = empleado.id;
        } else {
            return { total: 0, page, totalPages: 0, sesiones: [] };
        }
    }
    if (desde || hasta) {
        where.fecha_apertura = {};
        if (desde) where.fecha_apertura[Op.gte] = new Date(desde);
        if (hasta) where.fecha_apertura[Op.lte] = new Date(hasta);
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await SesionCaja.findAndCountAll({
        where,
        include: [
            { model: Empleado, as: 'empleado', attributes: ['id', 'nombre', 'apellido_paterno', 'apellido_materno'] },
        ],
        order: [['fecha_apertura', 'DESC']],
        limit,
        offset,
    });

    return { total: count, page, totalPages: Math.ceil(count / limit), sesiones: rows };
};

// ─── DETALLE COMPLETO DE UNA SESIÓN ─────────────────────────────────────────
export const getDetalleSesion = async (id_sesion) => {
    const sesion = await SesionCaja.findByPk(id_sesion, {
        include: [
            {
                model: Sucursal,
                as: 'sucursal',
                attributes: ['id', 'nombre']
            },
            {
                model: Empleado,
                as: 'empleado',
                attributes: ['id', 'nombre', 'apellido_paterno', 'apellido_materno']
            },
            {
                model: Venta,
                as: 'ventas',
                attributes: ['id', 'numero_comprobante', 'total', 'metodo_pago', 'createdAt'],
                include: [
                    {
                        model: Cliente,
                        as: 'cliente',
                        attributes: ['id', 'nombre', 'apellido_paterno', 'apellido_materno', 'ci', 'telefono', 'correo_electronico'],
                    },
                ],
            },
        ],
    });

    if (!sesion) {
        const err = new Error('Sesión no encontrada.');
        err.statusCode = 404;
        throw err;
    }

    const { ventasEfectivo, ventasDigital, totalVentas, cantidadVentas } =
        await calcularTotalesSesion(id_sesion);

    return {
        sesion,
        totales: {
            ventas_efectivo: ventasEfectivo,
            ventas_digital: ventasDigital,
            total_ventas: totalVentas,
            cantidad_ventas: cantidadVentas,
        },
    };
};