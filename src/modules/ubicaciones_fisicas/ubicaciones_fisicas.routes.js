import { Router } from 'express';
import { ubicacionesFisicasController } from './ubicaciones_fisicas.controller.js';
import { checkUbicacionFisicaExists } from './ubicaciones_fisicas.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createUbicacionFisicaSchema,
  updateUbicacionFisicaSchema,
  getUbicacionFisicaSchema,
  listUbicacionesFisicasSchema,
  listByUbicacionSchema,
} from './ubicaciones_fisicas.schema.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(validate(listUbicacionesFisicasSchema), ubicacionesFisicasController.list)
  .post(validate(createUbicacionFisicaSchema), ubicacionesFisicasController.create);

router
  .route('/full')
  .get(ubicacionesFisicasController.listFull);

router
  .route('/catalogo')
  .get(ubicacionesFisicasController.listCatalogo);

router
  .route('/por-ubicacion/:id_ubicacion')
  .get(validate(listByUbicacionSchema), ubicacionesFisicasController.listByUbicacion);

router
  .route('/:id')
  .get(validate(getUbicacionFisicaSchema), ubicacionesFisicasController.getById)
  .put(checkUbicacionFisicaExists, validate(updateUbicacionFisicaSchema), ubicacionesFisicasController.update)
  .delete(checkUbicacionFisicaExists, ubicacionesFisicasController.remove);

export default router;
