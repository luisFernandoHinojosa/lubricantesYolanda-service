import { Router } from 'express';
import { proveedoresController } from './proveedores.controller.js';
import { checkProveedorExists } from './proveedores.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createProveedorSchema,
  updateProveedorSchema,
  getProveedorSchema,
  listProveedoresSchema,
} from './proveedores.schema.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(validate(listProveedoresSchema), proveedoresController.listFull)
  .post(validate(createProveedorSchema), proveedoresController.create);

router
  .route('/catalogo')
  .get(proveedoresController.listCatalogo);


router
  .route('/:id')
  .get(validate(getProveedorSchema), proveedoresController.getById)
  .put(checkProveedorExists, validate(updateProveedorSchema), proveedoresController.update)
  .delete(checkProveedorExists, proveedoresController.remove);
export default router;
