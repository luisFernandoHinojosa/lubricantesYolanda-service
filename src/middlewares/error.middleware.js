// import logger from '../config/logger.js';
// import { saveError } from '../modules/errors/error.service.js';

// export const errorMiddleware = (err, req, res, next) => {
//   logger.error(err.message, { stack: err.stack });
//   saveError(err);

//   const statusCode = err.statusCode || 500;
//   const message = err.message || 'Internal Server Error';

//   res.status(statusCode).json({
//     success: false,
//     message: message,
//   });
// };
// src/shared/middlewares/errorHandler.js


import { AppError } from '../errors/AppError.js';

export const errorHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
      ...(err.details && { errors: err.details }),
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      status: 'error',
      code: 'CONFLICT',
      message: 'El registro ya existe',
    });
  }

  console.error('[ERROR INESPERADO]', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: 'Ocurrió un error inesperado',
  });
};