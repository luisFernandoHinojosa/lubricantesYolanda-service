import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import config from '../index.js';
import * as authService from '../../modules/auth/auth.service.js';
import { usuariosService } from '../../modules/usuarios/usuarios.service.js';

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.jwt.secret,
  passReqToCallback: true,
};

const jwtStrategy = new JwtStrategy(opts, async (req, payload, done) => {
  try {
    const token = req.headers.authorization.split(' ')[1];

    try {
      const isBlocked = await authService.isTokenBlocked(token);
      if (isBlocked) {
        return done(null, false, { message: 'El token ha sido invalidado (Logout).' });
      }
    } catch (redisError) {
      console.error('Advertencia: Redis no está disponible, omitiendo verificación de blacklist.', redisError.message);
    }
    const user = await usuariosService.getById(payload.id);
    if (user) {
      if (!user.esta_activo) {
        return done(null, false, { message: 'El usuario está inactivo.' });
      }
      return done(null, user);
    } else {
      return done(null, false, { message: 'El usuario asociado al token no existe.' });
    }
  } catch (error) {
    console.error(' Error crítico en estrategia JWT:', error);
    return done(error, false);
  }
});
export default jwtStrategy;