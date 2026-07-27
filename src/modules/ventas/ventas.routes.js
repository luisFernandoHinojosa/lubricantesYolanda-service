import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import {
    requireSesionAbierta,
    validateVenta,
} from '../ventas/ventas.middleware.js';
import {
    crearVenta,
    getVenta,
    listarVentas,
    getResumenSesion,
    anularVenta,
} from '../ventas/ventas.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', requireSesionAbierta, validateVenta, crearVenta);
router.get('/', listarVentas);
router.get('/sesion/:id_sesion/resumen', getResumenSesion);
router.get('/:id', getVenta);
router.put('/:id/anular', anularVenta);

export default router;