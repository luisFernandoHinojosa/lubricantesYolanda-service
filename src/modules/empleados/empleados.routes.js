import { Router } from 'express';
import { empleadosController } from './empleados.controller.js';
import { checkEmpleadoExists } from './empleados.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createEmpleadoSchema,
  updateEmpleadoSchema,
  getEmpleadoSchema,
  listEmpleadosSchema,
} from './empleados.schema.js';

const router = Router();

// router.use(authenticate);

router
  .route('/')
  .get(validate(listEmpleadosSchema), empleadosController.list)
  .post(validate(createEmpleadoSchema), empleadosController.create);

router
  .route('/:id')
  .get(validate(getEmpleadoSchema), empleadosController.getById)
  .put(checkEmpleadoExists, validate(updateEmpleadoSchema), empleadosController.update)
  .delete(checkEmpleadoExists, empleadosController.remove);

export default router;
