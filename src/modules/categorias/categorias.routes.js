import { Router } from 'express';
import { categoriasController } from './categorias.controller.js';
import { checkCategoriaExists } from './categorias.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createCategoriaSchema,
  updateCategoriaSchema,
  getCategoriaSchema,
  listCategoriasSchema,
} from './categorias.schema.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(validate(listCategoriasSchema), categoriasController.list)
  .post(validate(createCategoriaSchema), categoriasController.create);

router
  .route('/full')
  .get(categoriasController.listFull);

router
  .route('/:id')
  .get(validate(getCategoriaSchema), categoriasController.getById)
  .put(checkCategoriaExists, validate(updateCategoriaSchema), categoriasController.update)
  .delete(checkCategoriaExists, categoriasController.remove);

export default router;
