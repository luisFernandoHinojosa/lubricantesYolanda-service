import { Router } from 'express';
import { sucursalesController } from './sucursales.controller.js';
import { checkSucursalExists } from './sucursales.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createSucursalSchema,
  updateSucursalSchema,
  getSucursalSchema,
  listSucursalesSchema,
} from './sucursales.schema.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(validate(listSucursalesSchema), sucursalesController.list)
  .post(validate(createSucursalSchema), sucursalesController.create);

router
  .route('/full')
  .get(sucursalesController.listFull);

router
  .route('/catalogo')
  .get(sucursalesController.listCatalogo);

router
  .route('/:id')
  .get(validate(getSucursalSchema), sucursalesController.getById)
  .put(checkSucursalExists, validate(updateSucursalSchema), sucursalesController.update)
  .delete(checkSucursalExists, sucursalesController.remove);

export default router;
