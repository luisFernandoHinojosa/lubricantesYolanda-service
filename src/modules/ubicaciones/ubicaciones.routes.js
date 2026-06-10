import { Router } from 'express';
import { ubicacionesController } from './ubicaciones.controller.js';
import { checkUbicacionExists } from './ubicaciones.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createUbicacionSchema,
  updateUbicacionSchema,
  getUbicacionSchema,
  listUbicacionesSchema,
} from './ubicaciones.schema.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(validate(listUbicacionesSchema), ubicacionesController.list)
  .post(validate(createUbicacionSchema), ubicacionesController.create);

router
  .route('/full')
  .get(ubicacionesController.listFull);

router
  .route('/catalogo')
  .get(ubicacionesController.listCatalogo);

router
  .route('/:id')
  .get(validate(getUbicacionSchema), ubicacionesController.getById)
  .put(checkUbicacionExists, validate(updateUbicacionSchema), ubicacionesController.update)
  .delete(checkUbicacionExists, ubicacionesController.remove);

export default router;
