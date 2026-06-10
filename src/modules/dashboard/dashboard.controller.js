import asyncHandler from '../../utils/asyncHandler.js';
import * as dashboardService from './dashboard.service.js';

export const getResumen = asyncHandler(async (req, res, next) => {
    const data = await dashboardService.getResumen();
    res.status(200).json({ status: 'success', data });
});

export const getChartData = asyncHandler(async (req, res, next) => {
    const { filtro } = req.query;
    const data = await dashboardService.getChartData(filtro);
    res.status(200).json({ status: 'success', data });
});

export const getClientesTop = asyncHandler(async (req, res, next) => {
    const data = await dashboardService.getClientesTop();
    res.status(200).json({ status: 'success', data });
});

export const getProductosStock = asyncHandler(async (req, res, next) => {
    const data = await dashboardService.getProductosStock();
    res.status(200).json({ status: 'success', data });
});

export const getUltimosMovimientos = asyncHandler(async (req, res, next) => {
    const data = await dashboardService.getUltimosMovimientos();
    res.status(200).json({ status: 'success', data });
});

export const getCobranzasPendientes = asyncHandler(async (req, res, next) => {
    const data = await dashboardService.getCobranzasPendientes();
    res.status(200).json({ status: 'success', data });
});

export const getProductosMasVendidos = asyncHandler(async (req, res, next) => {
    const data = await dashboardService.getProductosMasVendidos();
    res.status(200).json({ status: 'success', data });
});

export const getProductosPorVencer = asyncHandler(async (req, res, next) => {
    const data = await dashboardService.getProductosPorVencer();
    res.status(200).json({ status: 'success', data });
});
