import express from 'express';
import * as movimientosController from './movimientos.controller.js';
import { validateCreateMovimiento, validateUpdateMovimiento, checkMovimientoExists, validateGetMovimientosByRange } from './movimientos.middleware.js';
import { sanitizeInput } from '../../middlewares/sanitizer.middleware.js';
import { authenticate } from '../auth/auth.middleware.js';

const router = express.Router();
router.use(authenticate);
router.route('/')
    .get(movimientosController.findAll)
    .post(sanitizeInput, validateCreateMovimiento, movimientosController.create);

router.get('/reporte/rango-fechas', validateGetMovimientosByRange, movimientosController.findByDateRange);

router.route('/:id')
    .get(checkMovimientoExists, movimientosController.findOne)
    .put(sanitizeInput, checkMovimientoExists, validateUpdateMovimiento, movimientosController.update)
    .delete(checkMovimientoExists, movimientosController.remove);

export default router;
