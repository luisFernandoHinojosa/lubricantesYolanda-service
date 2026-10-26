import asyncHandler from '../../utils/asyncHandler.js';
import * as ventaService from '../ventas/ventas.service.js';
import * as facturacionService from '../ventas/facturacion.service.js';

export const crearVenta = asyncHandler(async (req, res) => {
    const { id: id_usuario, name_user } = req.user;

    const venta = await ventaService.crearVenta({
        ...req.validated.body,
        sesion: req.sesionCaja,
        id_usuario,
        name_user,
    });

    const facturaFallida = venta.resultado_facturacion?.success === false;

    return res.status(201).json({
        status: "success",
        message: facturaFallida
            ? 'Venta registrada, pero la factura no pudo emitirse. Puede reintentarla desde Historial de ventas.'
            : 'Venta registrada exitosamente.',
        data: venta,
    });
});

export const getVenta = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const venta = await ventaService.getVentaById(id);
    return res.status(200).json({ status: "success", message: 'Venta obtenida exitosamente.', data: venta });
});

export const listarVentas = asyncHandler(async (req, res) => {
    const resultado = await ventaService.findAllVentas(req.validated.query);

    return res.status(200).json({
        status: "success",
        data: resultado
    });
});

export const getResumenSesion = asyncHandler(async (req, res) => {
    const { id_sesion } = req.params;
    const resumen = await ventaService.getResumenVentasSesion(id_sesion);
    return res.status(200).json({ status: "success", data: resumen });
});

export const anularVenta = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { id: id_usuario } = req.user;
    await ventaService.anularVenta(id, id_usuario);
    return res.status(200).json({
        status: "success",
        message: 'Venta anulada exitosamente.',
    });
});

export const facturarVenta = asyncHandler(async (req, res) => {
    const { name_user } = req.user;
    const { params, body } = req.validated;

    const venta = await ventaService.facturarVenta({
        id_venta: params.id,
        monto_recargo_iva: body.monto_recargo_iva,
        name_user,
    });

    const facturaFallida = venta.resultado_facturacion?.success === false;

    return res.status(200).json({
        status: "success",
        message: facturaFallida
            ? 'La factura no pudo emitirse. Puede reintentarla desde Historial de ventas.'
            : 'Factura emitida exitosamente.',
        data: venta,
    });
});

export const reintentarFactura = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name_user } = req.user;
    const resultado = await facturacionService.reintentarFactura(id, name_user);
    return res.status(200).json({
        status: "success",
        message: resultado?.success
            ? 'Factura emitida exitosamente.'
            : 'Error al emitir factura. Revise los detalles.',
        data: resultado,
    });
});
