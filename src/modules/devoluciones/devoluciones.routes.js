import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { requireSesionAbierta } from '../ventas/ventas.middleware.js';
import { validateDevolucion, validateCambio } from './devoluciones.middleware.js';
import {
    crearDevolucion,
    crearCambio,
    getDevolucion,
    listarDevoluciones,
    getDevolucionesDeVenta,
    getResumenDevolucionesSesion,
} from './devoluciones.controller.js';

const router = Router();

router.use(authenticate);

// Crear devolución (requiere sesión de caja abierta)
router.post('/devolucion', requireSesionAbierta, validateDevolucion, crearDevolucion);

// Crear cambio de producto (requiere sesión de caja abierta)
router.post('/cambio', requireSesionAbierta, validateCambio, crearCambio);

// Listar todas las devoluciones/cambios
router.get('/', listarDevoluciones);

// Resumen de devoluciones de una sesión de caja
router.get('/sesion/:id_sesion/resumen', getResumenDevolucionesSesion);

// Devoluciones/cambios de una venta específica
router.get('/venta/:id_venta', getDevolucionesDeVenta);

// Detalle de una devolución/cambio por ID
router.get('/:id', getDevolucion);

export default router;
