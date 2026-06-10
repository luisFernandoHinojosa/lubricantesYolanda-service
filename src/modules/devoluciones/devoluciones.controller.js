import asyncHandler from '../../utils/asyncHandler.js';
import * as devolucionService from './devoluciones.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /devoluciones/devolucion — Crear una devolución parcial o total
// ─────────────────────────────────────────────────────────────────────────────
export const crearDevolucion = asyncHandler(async (req, res, next) => {
    try {
        const { id: id_usuario, id_sucursal } = req.user;
        const { id_venta, id_sesion_caja, items, motivo, metodo_reembolso } = req.body;

        const devolucion = await devolucionService.crearDevolucion({
            id_venta,
            id_sucursal,
            id_sesion_caja,
            id_usuario,
            items,
            motivo,
            metodo_reembolso,
        });

        return res.status(201).json({
            status: 'success',
            message: 'Devolución registrada exitosamente.',
            data: devolucion,
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /devoluciones/cambio — Crear un cambio de producto
// ─────────────────────────────────────────────────────────────────────────────
export const crearCambio = asyncHandler(async (req, res, next) => {
    try {
        const { id: id_usuario, id_sucursal } = req.user;
        const { id_venta, id_sesion_caja, items, motivo, metodo_reembolso } = req.body;

        const cambio = await devolucionService.crearCambio({
            id_venta,
            id_sucursal,
            id_sesion_caja,
            id_usuario,
            items,
            motivo,
            metodo_reembolso,
        });

        return res.status(201).json({
            status: 'success',
            message: 'Cambio de producto registrado exitosamente.',
            data: cambio,
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /devoluciones/:id — Obtener detalle de una devolución/cambio
// ─────────────────────────────────────────────────────────────────────────────
export const getDevolucion = asyncHandler(async (req, res, next) => {
    try {
        const { id } = req.params;
        const devolucion = await devolucionService.getDevolucionById(id);
        return res.status(200).json({
            status: 'success',
            message: 'Devolución obtenida exitosamente.',
            data: devolucion,
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /devoluciones/ — Listar devoluciones con filtros
// ─────────────────────────────────────────────────────────────────────────────
export const listarDevoluciones = asyncHandler(async (req, res, next) => {
    try {
        const { tipo, desde, hasta, page, perPage, search } = req.query;
        const { id_sucursal } = req.user;

        const resultado = await devolucionService.findAllDevoluciones({
            search,
            id_sucursal,
            tipo,
            desde,
            hasta,
            page: parseInt(page, 10) || 1,
            perPage: parseInt(perPage, 10) || 20,
        });

        return res.status(200).json({
            status: 'success',
            data: resultado,
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /devoluciones/venta/:id_venta — Devoluciones de una venta
// ─────────────────────────────────────────────────────────────────────────────
export const getDevolucionesDeVenta = asyncHandler(async (req, res, next) => {
    try {
        const { id_venta } = req.params;
        const devoluciones = await devolucionService.getDevolucionesByVenta(id_venta);
        return res.status(200).json({
            status: 'success',
            data: devoluciones,
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /devoluciones/sesion/:id_sesion/resumen — Resumen de devoluciones de sesión
// ─────────────────────────────────────────────────────────────────────────────
export const getResumenDevolucionesSesion = asyncHandler(async (req, res, next) => {
    try {
        const { id_sesion } = req.params;
        const resumen = await devolucionService.getResumenDevolucionesSesion(id_sesion);
        return res.status(200).json({
            status: 'success',
            data: resumen,
        });
    } catch (err) {
        next(err);
    }
});
