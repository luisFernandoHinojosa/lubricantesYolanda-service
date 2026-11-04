import { Router } from 'express';
import { clienteController } from './clientes.controller.js';
import { checkClienteExists } from './clientes.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createClienteSchema,
  updateClienteSchema,
  getClienteSchema,
  getClienteByCiSchema,
  ajustarPuntosClienteSchema,
  listClientesSchema,
} from './clientes.schema.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(validate(listClientesSchema), clienteController.list)
  .post(validate(createClienteSchema), clienteController.create);

router
  .route('/top50')
  .get(clienteController.getTop50);

router
  .route('/ci/:ci')
  .get(validate(getClienteByCiSchema), clienteController.getByCi);

router
  .route('/:id/puntos')
  .patch(validate(ajustarPuntosClienteSchema), checkClienteExists, clienteController.ajustarPuntos);

router
  .route('/:id')
  .get(validate(getClienteSchema), clienteController.getById)
  .put(validate(updateClienteSchema), checkClienteExists, clienteController.update)
  .delete(validate(getClienteSchema), checkClienteExists, clienteController.remove);

export default router;
