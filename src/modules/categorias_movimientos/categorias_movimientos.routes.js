import express from 'express';
import * as categoriasMovimientosController from './categorias_movimientos.controller.js';
import { validateCreateCategoriaMovimiento, validateUpdateCategoriaMovimiento, checkCategoriaMovimientoExists } from './categorias_movimientos.middleware.js';
import { sanitizeInput } from '../../middlewares/sanitizer.middleware.js';
import { authenticate } from '../auth/auth.middleware.js';

const router = express.Router();
router.use(authenticate);
router.route('/')
    .get(categoriasMovimientosController.findAll)
    .post(sanitizeInput, validateCreateCategoriaMovimiento, categoriasMovimientosController.create);

router.route('/:id')
    .get(checkCategoriaMovimientoExists, categoriasMovimientosController.findOne)
    .put(sanitizeInput, checkCategoriaMovimientoExists, validateUpdateCategoriaMovimiento, categoriasMovimientosController.update)
    .delete(checkCategoriaMovimientoExists, categoriasMovimientosController.remove);

export default router;
