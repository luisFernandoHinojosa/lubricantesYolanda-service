import { Router } from 'express';
import { productosSeriesController } from './productos_series.controller.js';
import { checkProductoSerieExists } from './productos_series.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createProductoSerieSchema,
  updateProductoSerieSchema,
  getProductoSerieSchema,
  listProductosSeriesSchema,
} from './productos_series.schema.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(validate(listProductosSeriesSchema), productosSeriesController.list)
  .post(validate(createProductoSerieSchema), productosSeriesController.create);

router
  .route('/:id')
  .get(validate(getProductoSerieSchema), productosSeriesController.getById)
  .put(checkProductoSerieExists, validate(updateProductoSerieSchema), productosSeriesController.update)
  .delete(checkProductoSerieExists, productosSeriesController.remove);

export default router;
