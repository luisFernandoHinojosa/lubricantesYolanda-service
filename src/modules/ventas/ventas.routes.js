import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { requireSesionAbierta } from '../ventas/ventas.middleware.js';
import { crearVentaSchema, listarVentasSchema } from '../ventas/ventas.schema.js';
import {
    crearVenta,
    getVenta,
    listarVentas,
    getResumenSesion,
    anularVenta,
    reintentarFactura,
} from '../ventas/ventas.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', requireSesionAbierta, validate(crearVentaSchema), crearVenta);
router.get('/', validate(listarVentasSchema), listarVentas);
router.get('/sesion/:id_sesion/resumen', getResumenSesion);
router.get('/:id', getVenta);
router.put('/:id/anular', anularVenta);
router.post('/:id/reintentar-factura', reintentarFactura);

export default router;
