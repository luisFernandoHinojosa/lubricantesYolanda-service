import { Router } from 'express';
import { unidadMedidasController } from './unidad_medidas.controller.js';
import { checkUnidadMedidaExists } from './unidad_medidas.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createUnidadMedidaSchema,
  updateUnidadMedidaSchema,
  getUnidadMedidaSchema,
  listUnidadMedidasSchema,
} from './unidad_medidas.schema.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(validate(listUnidadMedidasSchema), unidadMedidasController.list)
  .post(validate(createUnidadMedidaSchema), unidadMedidasController.create);

router
  .route('/full')
  .get(unidadMedidasController.listFull);

router
  .route('/:id')
  .get(validate(getUnidadMedidaSchema), unidadMedidasController.getById)
  .put(checkUnidadMedidaExists, validate(updateUnidadMedidaSchema), unidadMedidasController.update)
  .delete(checkUnidadMedidaExists, unidadMedidasController.remove);

export default router;
