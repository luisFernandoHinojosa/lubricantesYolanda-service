import { Router } from 'express';
import { usuariosController } from './usuarios.controller.js';
import { checkUsuarioExists, existNameUserAndRol, checkEmailIsAvailable } from './usuarios.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../auth/auth.middleware.js';
import {
  createUsuarioSchema,
  updateUsuarioSchema,
  getUsuarioSchema,
} from './usuarios.schema.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(usuariosController.listAll)
  .post(
      validate(createUsuarioSchema), 
      existNameUserAndRol, 
      checkEmailIsAvailable, 
      usuariosController.create
    );

router
  .route('/:id')
  .get(validate(getUsuarioSchema), usuariosController.getById)
  .put(
      checkUsuarioExists, 
      validate(updateUsuarioSchema), 
      existNameUserAndRol, 
      checkEmailIsAvailable, 
      usuariosController.update
    )
  .delete(checkUsuarioExists, usuariosController.remove);

export default router;
