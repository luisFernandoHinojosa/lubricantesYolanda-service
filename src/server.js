import dotenv from 'dotenv';
import app from './app.js';
import config from './config/index.js';
import db from './database/index.js';
import logger from './config/logger.js';
import redisClient from './config/redis.js';
import { cache } from './services/cache.service.js';
// import { runSeeders } from './database/seeders/index.js';

const startServer = async () => {
  try {
    console.log('Paso 1');
    await db.sequelize.authenticate();
    // await db.sequelize.query('DROP SCHEMA IF EXISTS public CASCADE;');
    // await db.sequelize.query('CREATE SCHEMA public;');
    await db.sequelize.sync(); // { force: true } { alter: true }
    //await runSeeders();
    cache.setClient(redisClient);
    logger.info('CacheService conectado a Redis');
    console.log('Paso 6: Abriendo puerto del servidor...');
    const server = app.listen(config.server.port, () => {
      logger.info(`Server is running on port ${config.server.port}`);
      logger.info(`Environment: ${config.server.nodeEnv}`)
      logger.info(`Access API at http://${config.server.serverHost}:${config.server.port}/api/v1`);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
