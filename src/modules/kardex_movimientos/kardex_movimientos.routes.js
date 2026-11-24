import { Router } from 'express';
import { kardexMovimientoController } from './kardex_movimientos.controller.js';
import { checkKardexMovimientoExists } from './kardex_movimientos.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import { listKardexSchema, getKardexSchema, tarjetaKardexSchema } from './kardex_movimientos.schema.js';

// El kardex es de solo lectura: los movimientos los generan compras, ventas, devoluciones,
// lotes y stock_distribucion (traslados/ajustes). Las correcciones se hacen con un AJUSTE.
const router = Router();

router.use(authenticate);

router.get('/', validate(listKardexSchema), kardexMovimientoController.list);

router.get('/producto/:id_producto', validate(tarjetaKardexSchema), kardexMovimientoController.tarjeta);

router.get('/:id', validate(getKardexSchema), checkKardexMovimientoExists, kardexMovimientoController.getById);

export default router;
