import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validateProforma } from './proformas.middleware.js';
import { requireSesionAbierta } from '../ventas/ventas.middleware.js';
import {
    crearProforma,
    getProforma,
    listarProformas,
    actualizarProforma,
    facturarProforma
} from './proformas.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', validateProforma, crearProforma);
router.get('/', listarProformas);
router.get('/:id', getProforma);
router.put('/:id', validateProforma, actualizarProforma);
// Para facturar se requiere caja abierta, ya que se cobrará
router.post('/:id/facturar', requireSesionAbierta, facturarProforma);

export default router;
