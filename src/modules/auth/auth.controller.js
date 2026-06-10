import asyncHandler from '../../utils/asyncHandler.js';
import {
  createUsuario,
  findUserByEmail,
  findUserById,
  usuariosService
} from '../usuarios/usuarios.service.js';
import * as authService from './auth.service.js';
import db from '../../database/index.js';
import { Op } from 'sequelize';
import passport from 'passport';


// REGISTRO
export const register = asyncHandler(async (req, res, next) => {
  const newUser = await createUsuario(req.body);
  res.status(201).json({ status: 'success', message: 'Usuario registrado exitosamente.', data: newUser });
});

// LOGIN
export const login = asyncHandler(async (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: info ? info.message : 'Credenciales incorrectas'
      });
    }
    const accessToken = authService.signToken(user);
    const refreshToken = authService.signRefreshToken(user);
    // const userJson = user.toJSON();
    // delete userJson.password_hash;
    // if (user.Role) {
    // userJson.code_rol = user.Role.code_rol;
    // delete userJson.Role;
    // }

    res.status(200).json({
      status: 'success',
      accessToken,
      refreshToken,
      // data: {
      // user: userJson
      // },
    });
  })(req, res, next);
});

// OLVIDÉ MI CONTRASEÑA
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  const user = await findUserByEmail(email);

  if (user) {
    const { resetToken, password_reset_token, password_reset_expires } = authService.generatePasswordResetToken();
    user.password_reset_token = password_reset_token;
    user.password_reset_expires = password_reset_expires;
    await user.save();

    await authService.sendPasswordResetEmail(user, resetToken);
  }

  res.status(200).json({ status: 'success', message: 'Si el email está registrado, recibirás un enlace para restablecer tu contraseña.' });
});

// RESTABLECER CONTRASEÑA
export const resetPassword = asyncHandler(async (req, res, next) => {
  const hashedToken = authService.hashToken(req.params.token);

  const user = await db.Usuario.findOne({
    where: {
      password_reset_token: hashedToken,
      password_reset_expires: { [Op.gt]: Date.now() },
    },
  });

  if (!user) {
    return res.status(400).json({ status: 'error', message: 'El token es inválido o ha expirado.' });
  }

  const newPasswordHash = await usuariosService.hashPassword(req.body.password);
  user.password_hash = newPasswordHash;
  user.password_reset_token = null;
  user.password_reset_expires = null;
  await user.save();

  res.status(200).json({ status: 'success', message: 'Contraseña actualizada exitosamente.' });
});

export const logout = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    await authService.add(token);
  }
  res.status(200).json({ status: 'success', message: 'Sesión cerrada exitosamente.' });
});

export const getProfile = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const profile = await findUserById(userId);
  res.status(200).json({ status: 'success', data: profile });
});

export const refreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ status: 'error', message: 'Refresh token es requerido' });
  }

  try {
    const decoded = authService.verifyRefreshToken(refreshToken);
    const user = await findUserById(decoded.id);

    if (!user || !user.esta_activo) {
      return res.status(401).json({ status: 'error', message: 'Usuario no encontrado o inactivo' });
    }

    const accessToken = authService.signToken(user);
    res.status(200).json({ status: 'success', accessToken });
  } catch (error) {
    return res.status(401).json({ status: 'error', message: 'Refresh token inválido o expirado' });
  }
});

export const me = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const profile = await db.Usuario.findByPk(userId, {
    include: [
      {
        model: db.Empleado,
        as: 'Empleado',
      },
      {
        model: db.Role,
      }
    ],
    attributes: {
      exclude: ['password_hash', 'password_reset_token', 'password_reset_expires']
    }
  });

  if (!profile) {
    return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
  }

  res.status(200).json({ status: 'success', data: profile });
});