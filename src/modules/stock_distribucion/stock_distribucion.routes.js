import express from 'express';
import * as stockDistribucionController from './stock_distribucion.controller.js';
import { validateCreateStockDistribucion, validateUpdateStockDistribucion, validateTrasladoStock, checkStockDistribucionExists } from './stock_distribucion.middleware.js';
import { sanitizeInput } from '../../middlewares/sanitizer.middleware.js';
import { authenticate } from '../auth/auth.middleware.js';

const router = express.Router();

router.use(authenticate);
router.post('/traslado', sanitizeInput, validateTrasladoStock, stockDistribucionController.traslado);

router.get('/total/:id_producto', stockDistribucionController.getTotalStock);

router.get('/por-ubicacion/:id_producto', stockDistribucionController.getStockPorUbicacion);

router.route('/')
    .get(stockDistribucionController.findAll)
    .post(sanitizeInput, validateCreateStockDistribucion, stockDistribucionController.create);

router.route('/:id')
    .get(checkStockDistribucionExists, stockDistribucionController.findOne)
    .put(sanitizeInput, checkStockDistribucionExists, validateUpdateStockDistribucion, stockDistribucionController.update)
    .delete(checkStockDistribucionExists, stockDistribucionController.remove);

export default router;
