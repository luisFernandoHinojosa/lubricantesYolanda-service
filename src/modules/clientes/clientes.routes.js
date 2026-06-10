import { Router } from 'express';
import { clienteController } from './clientes.controller.js';
import { checkClienteExists } from './clientes.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createClienteSchema,
  updateClienteSchema,
  getClienteSchema,
  listClientesSchema,
} from './clientes.schema.js';

const router = Router();

// router.use(authenticate);

router
  .route('/')
  .get(validate(listClientesSchema), clienteController.list)
  .post(validate(createClienteSchema), clienteController.create);

router
  .route('/top50')
  .get(clienteController.getTop50);

router
  .route('/:id')
  .get(validate(getClienteSchema), clienteController.getById)
  .put(checkClienteExists, validate(updateClienteSchema), clienteController.update)
  .delete(checkClienteExists, clienteController.remove);

export default router;