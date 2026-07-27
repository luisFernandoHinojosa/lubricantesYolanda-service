import asyncHandler from '../../utils/asyncHandler.js';
import * as ventaService from '../ventas/ventas.service.js';

export const crearVenta = asyncHandler(async (req, res, next) => {
    try {
        const { id: id_usuario, id_sucursal } = req.user;
        const {
            id_sesion_caja,
            id_cliente,
            items,
            tipo_descuento_global,
            valor_descuento_global,
            metodo_pago,
            monto_pagado,
            notas,
        } = req.body;

        const venta = await ventaService.crearVenta({
            id_sucursal,
            id_sesion_caja,
            id_usuario,
            id_cliente,
            items,
            tipo_descuento_global,
            valor_descuento_global,
            metodo_pago,
            monto_pagado,
            notas,
        });

        return res.status(201).json({
            status: "success",
            message: 'Venta registrada exitosamente.',
            data: venta,
        });
    } catch (err) {
        next(err);
    }
});

export const getVenta = asyncHandler(async (req, res, next) => {
    try {
        const { id } = req.params;
        const venta = await ventaService.getVentaById(id);
        return res.status(200).json({ status: "success", message: 'Venta obtenida exitosamente.', data: venta });
    } catch (err) {
        next(err);
    }
});

export const listarVentas = asyncHandler(async (req, res, next) => {
    try {
        const {
            id_sesion_caja,
            id_usuario,
            id_cliente,
            metodo_pago,
            desde,
            hasta,
            page,
            perPage,
            search
        } = req.query;

        const { id_sucursal } = req.user;

        const resultado = await ventaService.findAllVentas({
            search,
            id_sucursal,
            id_sesion_caja,
            id_usuario,
            id_cliente,
            metodo_pago,
            desde,
            hasta,
            page: parseInt(page, 10) || 1,
            perPage: parseInt(perPage, 10) || 20,
        });

        return res.status(200).json({
            status: "success",
            data: resultado
        });
    } catch (err) {
        next(err);
    }
});

export const getResumenSesion = asyncHandler(async (req, res, next) => {
    try {
        const { id_sesion } = req.params;
        const resumen = await ventaService.getResumenVentasSesion(id_sesion);
        return res.status(200).json({ status: "success", data: resumen });
    } catch (err) {
        next(err);
    }
});

export const anularVenta = asyncHandler(async (req, res, next) => {
    try {
        const { id } = req.params;
        const { id: id_usuario } = req.user;
        const ventaAnulada = await ventaService.anularVenta(id, id_usuario);
        return res.status(200).json({
            status: "success",
            message: 'Venta anulada exitosamente.',
            //data: ventaAnulada 
        });
    } catch (err) {
        next(err);
    }
});