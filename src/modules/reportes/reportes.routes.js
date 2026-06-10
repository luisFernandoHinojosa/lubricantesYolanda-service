import express from 'express';
import * as reportesController from './reportes.controller.js';

const router = express.Router();

router.get('/ventas', reportesController.reporteVentas);

router.get('/compras', reportesController.reporteCompras);

router.get('/inventario', reportesController.reporteInventario);

router.get('/financiero', reportesController.reporteFinanciero);
router.get('/sesiones-caja', reportesController.reporteSesionesCaja);

router.get('/productos', reportesController.reporteProductos);

router.get('/clientes', reportesController.reporteClientes);

router.get('/empleados', reportesController.reporteEmpleados);

export default router;
