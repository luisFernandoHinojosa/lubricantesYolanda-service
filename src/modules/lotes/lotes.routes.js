import { Router } from 'express';
import { lotesController } from './lotes.controller.js';
import { checkLoteExists } from './lotes.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createLoteSchema,
  updateLoteSchema,
  getLoteSchema,
  listLotesSchema,
} from './lotes.schema.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(validate(listLotesSchema), lotesController.list)
  .post(validate(createLoteSchema), lotesController.create);

router
  .route('/producto/:id_producto')
  .get(lotesController.getByProductoId);

router
  .route('/:id')
  .get(validate(getLoteSchema), lotesController.getById)
  .put(checkLoteExists, validate(updateLoteSchema), lotesController.update)
  .delete(checkLoteExists, lotesController.remove);

export default router;
