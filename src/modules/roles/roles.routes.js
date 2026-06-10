import { Router } from 'express';
import { rolesController } from './roles.controller.js';
import { checkRoleExists } from './roles.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createRoleSchema,
  updateRoleSchema,
  getRoleSchema,
} from './roles.schema.js';

const router = Router();

// router.use(authenticate);

router
  .route('/')
  .get(rolesController.listAll)
  .post(validate(createRoleSchema), rolesController.create);

router
  .route('/full')
  .get(rolesController.list)
  .post(validate(createRoleSchema), rolesController.create);

router
  .route('/catalogo')
  .get(rolesController.listCatalogo);

router
  .route('/:id')
  .get(validate(getRoleSchema), rolesController.getById)
  .put(checkRoleExists, validate(updateRoleSchema), rolesController.update)
  .delete(checkRoleExists, rolesController.remove);

export default router;