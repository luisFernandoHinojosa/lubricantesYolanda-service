import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import requestIp from 'request-ip';
import routes from './routes/index.js';
import passport from 'passport';
import './config/passport/index.js'
import { errorHandler } from './middlewares/error.middleware.js';

const app = express();

app.use(passport.initialize());

app.use(cors());
app.use(helmet());
app.use(hpp());
app.use(requestIp.mw());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use(limiter);

app.use('/api/v1', routes);

app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: 'Resource not found',
  });
});

app.use(errorHandler);


export default app;
