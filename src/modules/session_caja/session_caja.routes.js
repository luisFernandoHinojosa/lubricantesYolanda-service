import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import {
    validateAperturaCaja,
    validateCierreCaja,
} from '../ventas/ventas.middleware.js';
import {
    abrirCaja,
    getSesionActiva,
    cerrarCaja,
    getHistorial,
    getDetalleSesion,
} from '../session_caja/session_caja.controller.js';

const router = Router();

router.use(authenticate);
router.post('/abrir', validateAperturaCaja, abrirCaja);
router.get('/activa', getSesionActiva);
router.patch('/:id/cerrar', validateCierreCaja, cerrarCaja);
router.get('/historial', getHistorial);
router.get('/:id', getDetalleSesion);

export default router;