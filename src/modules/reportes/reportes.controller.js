import asyncHandler from '../../utils/asyncHandler.js';
import * as reportesService from './reportes.service.js';

export const reporteVentas = asyncHandler(async (req, res) => {
    const data = await reportesService.getReporteVentas(req.query);
    res.status(200).json({ status: 'success', data });
});

export const reporteCompras = asyncHandler(async (req, res) => {
    const data = await reportesService.getReporteCompras(req.query);
    res.status(200).json({ status: 'success', data });
});

export const reporteInventario = asyncHandler(async (req, res) => {
    const data = await reportesService.getReporteInventario(req.query);
    res.status(200).json({ status: 'success', data });
});

export const reporteFinanciero = asyncHandler(async (req, res) => {
    const data = await reportesService.getReporteFinanciero(req.query);
    res.status(200).json({ status: 'success', data });
});

export const reporteSesionesCaja = asyncHandler(async (req, res) => {
    const data = await reportesService.getReporteSesionesCaja(req.query);
    res.status(200).json({ status: 'success', data });
});

export const reporteProductos = asyncHandler(async (req, res) => {
    const data = await reportesService.getReporteProductos(req.query);
    res.status(200).json({ status: 'success', data });
});

export const reporteClientes = asyncHandler(async (req, res) => {
    const data = await reportesService.getReporteClientes(req.query);
    res.status(200).json({ status: 'success', data });
});

export const reporteEmpleados = asyncHandler(async (req, res) => {
    const data = await reportesService.getReporteEmpleados(req.query);
    res.status(200).json({ status: 'success', data });
});
