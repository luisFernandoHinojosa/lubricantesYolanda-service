import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
// import db from '../../models/index.js';
import * as usuariosService from '../../modules/usuarios/usuarios.service.js';

const localStrategy = new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password',
  },
  async (email, password, done) => {
    try {
      const user = await usuariosService.findUserByEmail(email);

      if (!user) {
        return done(null, false, { message: 'Email o contraseña incorrectos.' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        return done(null, false, { message: 'Email o contraseña incorrectos.' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
);

export default localStrategy;