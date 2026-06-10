import passport from 'passport';

export const localAuth = passport.authenticate('local', { session: false });

export const authenticate = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      console.error('Error de Autenticación:', err.message);
      return next(err);
    }
    if (!user) {
      const message = info ? info.message : 'No autorizado';
      console.warn('Acceso denegado:', message);
      return res.status(401).json({
        status: 'error',
        message: 'Acceso Denegado',
        detail: message
      });
    }
    req.user = user;
    next();

  })(req, res, next);
};