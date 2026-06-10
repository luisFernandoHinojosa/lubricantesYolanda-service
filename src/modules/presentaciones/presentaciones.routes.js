import { Router } from 'express';
import { presentacionesController } from './presentaciones.controller.js';
import { checkPresentacionExists } from './presentaciones.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createPresentacionSchema,
  updatePresentacionSchema,
  getPresentacionSchema,
  listPresentacionesSchema,
} from './presentaciones.schema.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(validate(listPresentacionesSchema), presentacionesController.list)
  .post(validate(createPresentacionSchema), presentacionesController.create);

router
  .route('/:id')
  .get(validate(getPresentacionSchema), presentacionesController.getById)
  .put(checkPresentacionExists, validate(updatePresentacionSchema), presentacionesController.update)
  .delete(checkPresentacionExists, presentacionesController.remove);

export default router;
