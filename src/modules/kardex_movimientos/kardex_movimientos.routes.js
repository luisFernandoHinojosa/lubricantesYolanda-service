import express from 'express';
import * as kardexController from './kardex_movimientos.controller.js';
import { validateCreateKardexMovimiento, validateUpdateKardexMovimiento, checkKardexMovimientoExists } from './kardex_movimientos.middleware.js';
import { sanitizeInput } from '../../middlewares/sanitizer.middleware.js';
// Import auth middleware if user tracking is needed, e.g., import { protect } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.route('/')
    .get(kardexController.findAll)
    .post(sanitizeInput, validateCreateKardexMovimiento, kardexController.create);

router.route('/:id')
    .get(checkKardexMovimientoExists, kardexController.findOne)
    .put(sanitizeInput, checkKardexMovimientoExists, validateUpdateKardexMovimiento, kardexController.update)
    .delete(checkKardexMovimientoExists, kardexController.remove);

export default router;
