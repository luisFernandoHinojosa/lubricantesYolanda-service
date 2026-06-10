import * as sesionCajaService from '../session_caja/session_caja.service.js';
import asyncHandler from '../../utils/asyncHandler.js';

// ─── ABRIR CAJA ───────────────────────────────────────────────────────────────
export const abrirCaja = asyncHandler(async (req, res, next) => {
    try {
        const { monto_apertura } = req.body;
        const { id: id_usuario, id_sucursal } = req.user; // viene del middleware de auth
        console.log("Test", req.user);

        const sesion = await sesionCajaService.abrirSesion({
            id_sucursal,
            id_usuario,
            monto_apertura: parseFloat(monto_apertura),
        });

        return res.status(201).json({
            status: 'success',
            message: 'Sesión de caja abierta correctamente.',
            data: sesion,
        });
    } catch (err) {
        next(err);
    }
});

// ─── OBTENER SESIÓN ACTIVA DEL USUARIO ───────────────────────────────────────
export const getSesionActiva = asyncHandler(async (req, res, next) => {
    try {
        const { id: id_usuario, id_sucursal } = req.user;

        const sesion = await sesionCajaService.getSesionActiva({ id_usuario, id_sucursal });

        return res.status(200).json({
            status: 'success',
            message: 'Sesión activa obtenida correctamente.',
            data: sesion,
        });
    } catch (err) {
        next(err);
    }
});

// ─── CERRAR CAJA (ARQUEO) ─────────────────────────────────────────────────────
export const cerrarCaja = asyncHandler(async (req, res, next) => {
    try {
        const { id: id_sesion } = req.params;
        const { monto_cierre } = req.body;
        const { id: id_usuario } = req.user;

        if (monto_cierre === undefined || monto_cierre === null) {
            return res.status(400).json({
                status: 'error',
                message: 'El monto de cierre es requerido.',
            });
        }

        const resultado = await sesionCajaService.cerrarSesion({
            id_sesion,
            id_usuario,
            monto_cierre: parseFloat(monto_cierre),
        });

        return res.status(200).json({
            status: 'success',
            message: 'Caja cerrada y arqueo registrado correctamente.',
            data: resultado,
        });
    } catch (err) {
        next(err);
    }
});

// ─── HISTORIAL DE SESIONES ────────────────────────────────────────────────────
export const getHistorial = asyncHandler(async (req, res, next) => {
    try {
        const { id_sucursal } = req.user;
        const { id_usuario, desde, hasta, page, limit } = req.query;

        const resultado = await sesionCajaService.getHistorialSesiones({
            id_sucursal,
            id_usuario,
            desde,
            hasta,
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
        });
        return res.status(200).json({
            status: 'success',
            message: 'Historial de sesiones obtenido correctamente.',
            data: resultado,
        });
    } catch (err) {
        next(err);
    }
});

// ─── DETALLE DE UNA SESIÓN ────────────────────────────────────────────────────
export const getDetalleSesion = asyncHandler(async (req, res, next) => {
    try {
        const { id } = req.params;
        const resultado = await sesionCajaService.getDetalleSesion(id);
        return res.status(200).json({
            status: 'success',
            message: 'Detalle de la sesión obtenido correctamente.',
            data: resultado,
        });
    } catch (err) {
        next(err);
    }
});