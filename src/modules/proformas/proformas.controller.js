import asyncHandler from '../../utils/asyncHandler.js';
import * as proformaService from './proformas.service.js';

export const crearProforma = asyncHandler(async (req, res, next) => {
    try {
        const { id: id_usuario, id_sucursal } = req.user;
        const {
            id_cliente,
            items,
            tipo_descuento_global,
            valor_descuento_global,
            validez_dias,
            notas,
        } = req.body;

        const proforma = await proformaService.crearProforma({
            id_sucursal,
            id_usuario,
            id_cliente,
            items,
            tipo_descuento_global,
            valor_descuento_global,
            validez_dias,
            notas,
        });

        return res.status(201).json({
            status: "success",
            message: 'Proforma registrada exitosamente.',
            data: proforma,
        });
    } catch (err) {
        next(err);
    }
});

export const getProforma = asyncHandler(async (req, res, next) => {
    try {
        const { id } = req.params;
        const proforma = await proformaService.getProformaById(id);
        return res.status(200).json({ status: "success", message: 'Proforma obtenida exitosamente.', data: proforma });
    } catch (err) {
        next(err);
    }
});

export const listarProformas = asyncHandler(async (req, res, next) => {
    try {
        const {
            id_usuario,
            id_cliente,
            estado,
            desde,
            hasta,
            page,
            perPage,
            search
        } = req.query;

        const { id_sucursal } = req.user;

        const resultado = await proformaService.findAllProformas({
            search,
            id_sucursal,
            id_usuario,
            id_cliente,
            estado,
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

export const actualizarProforma = asyncHandler(async (req, res, next) => {
    try {
        const { id } = req.params;
        const { id: id_usuario, id_sucursal } = req.user;
        const {
            id_cliente,
            items,
            tipo_descuento_global,
            valor_descuento_global,
            validez_dias,
            notas,
        } = req.body;

        const proforma = await proformaService.actualizarProforma(id, {
            id_sucursal,
            id_usuario,
            id_cliente,
            items,
            tipo_descuento_global,
            valor_descuento_global,
            validez_dias,
            notas,
        });

        return res.status(200).json({
            status: "success",
            message: 'Proforma actualizada exitosamente.',
            data: proforma,
        });
    } catch (err) {
        next(err);
    }
});

export const facturarProforma = asyncHandler(async (req, res, next) => {
    try {
        const { id } = req.params;
        const { id: id_usuario, id_sucursal } = req.user;
        const {
            id_sesion_caja,
            pagos,
            notas_adicionales,
        } = req.body;

        const monto_pagado = pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);

        const venta = await proformaService.facturarProforma(id, {
            id_sucursal,
            id_usuario,
            id_sesion_caja,
            pagos,
            monto_pagado,
            notas_adicionales,
        });

        return res.status(200).json({
            status: "success",
            message: 'Proforma facturada exitosamente. Se ha generado la venta.',
            data: venta,
        });
    } catch (err) {
        next(err);
    }
});
