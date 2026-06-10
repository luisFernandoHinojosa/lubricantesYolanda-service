import express from 'express';
import * as authController from './auth.controller.js';
import * as userMiddleware from '../usuarios/usuarios.middleware.js';
import { authenticate } from './auth.middleware.js';
import { validate } from '../../middlewares/validate.js';
import { createUsuarioSchema } from '../usuarios/usuarios.schema.js';

const router = express.Router();

router.post(
  '/register',
  validate(createUsuarioSchema),
  userMiddleware.checkEmailIsAvailable,
  authController.register
);

router.post('/login', authController.login);

router.post('/forgot-password', authController.forgotPassword);

router.post('/reset-password/:token', authController.resetPassword);


// --- RUTAS PROTEGIDAS (Ejemplo) ---

router.post('/refresh-token', authController.refreshToken);

router.get('/me', authenticate, authController.me);

router.get('/profile', authenticate, authController.getProfile);

router.post('/logout', authenticate, authController.logout);


export default router;