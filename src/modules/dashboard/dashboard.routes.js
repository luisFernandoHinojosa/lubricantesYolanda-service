import express from 'express';
import * as dashboardController from './dashboard.controller.js';

const router = express.Router();

router.get('/resumen', dashboardController.getResumen);
router.get('/chart', dashboardController.getChartData);
router.get('/clientes-top', dashboardController.getClientesTop);
router.get('/productos-stock', dashboardController.getProductosStock);
router.get('/movimientos', dashboardController.getUltimosMovimientos);
router.get('/cobranzas', dashboardController.getCobranzasPendientes);
router.get('/productos-top', dashboardController.getProductosMasVendidos);
router.get('/productos-vencer', dashboardController.getProductosPorVencer);

export default router;
