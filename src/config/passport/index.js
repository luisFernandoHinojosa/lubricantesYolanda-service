import passport from 'passport';
import localStrategy from './local.strategy.js';
import jwtStrategy from './jwt.strategy.js';

passport.use(localStrategy);
passport.use(jwtStrategy);

// passport.serializeUser((user, done) => {
//   done(null, user.id);
// });