import asyncHandler from '../../utils/asyncHandler.js';
import * as ventaService from '../ventas/ventas.service.js';
import { buscarSesionAbierta } from '../ventas/ventas.middleware.js';

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

export const getVentaPorComprobante = asyncHandler(async (req, res) => {
    const { numero } = req.params;
    const venta = await ventaService.getVentaByComprobante(numero);
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

    // Cambiar de cliente solo se permite en ventas de la sesión de caja abierta
    const sesion = body.id_cliente ? await buscarSesionAbierta(req.user) : null;

    const venta = await ventaService.facturarVenta({
        id_venta: params.id,
        porcentaje_recargo_iva: body.porcentaje_recargo_iva,
        metodo_pago_recargo: body.metodo_pago_recargo,
        id_cliente: body.id_cliente,
        id_sesion_abierta: sesion?.id ?? null,
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

export const anularFactura = asyncHandler(async (req, res) => {
    const venta = await ventaService.anularFacturaVenta({ id_venta: req.validated.params.id });

    return res.status(200).json({
        status: "success",
        message: 'Factura anulada. Puede volver a emitirla desde Historial de ventas.',
        data: venta,
    });
});

export const reintentarFactura = asyncHandler(async (req, res) => {
    const { name_user } = req.user;
    const { params, body } = req.validated;

    const venta = await ventaService.reintentarFacturaVenta({
        id_venta: params.id,
        id_cliente: body.id_cliente,
        name_user,
    });

    const facturaFallida = venta.resultado_facturacion?.success === false;

    return res.status(200).json({
        status: "success",
        message: facturaFallida
            ? 'La factura no pudo emitirse. Revise los detalles e intente nuevamente.'
            : 'Factura emitida exitosamente.',
        data: venta,
    });
});
