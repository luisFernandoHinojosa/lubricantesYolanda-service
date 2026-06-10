import express from 'express';
import {
    createCompra,
    getCompraById,
    getAllCompras,
    update,
    remove
} from './compras.controller.js';
import { authenticate } from '../auth/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.route('/')
    .post(createCompra)
    .get(getAllCompras);

router.route('/:id')
    .get(getCompraById)
    .put(update)
    .delete(remove);

export default router;
