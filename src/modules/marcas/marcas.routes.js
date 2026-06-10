import { Router } from 'express';
import { marcasController } from './marcas.controller.js';
import { checkMarcaExists } from './marcas.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createMarcaSchema,
  updateMarcaSchema,
  getMarcaSchema,
  listMarcasSchema,
} from './marcas.schema.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(validate(listMarcasSchema), marcasController.list)
  .post(validate(createMarcaSchema), marcasController.create);

router
  .route('/full')
  .get(marcasController.listFull);

router
  .route('/:id')
  .get(validate(getMarcaSchema), marcasController.getById)
  .put(checkMarcaExists, validate(updateMarcaSchema), marcasController.update)
  .delete(checkMarcaExists, marcasController.remove);

export default router;
