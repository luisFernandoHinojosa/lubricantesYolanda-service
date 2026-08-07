import dotenv from 'dotenv';
import app from './app.js';
import config from './config/index.js';
import db from './database/index.js';
import logger from './config/logger.js';
import redisClient from './config/redis.js';
import { cache } from './services/cache.service.js';
import { runSeeders } from './database/seeders/index.js';

const startServer = async () => {
  try {
    console.log('Paso 1');
    await db.sequelize.authenticate();
    // await db.sequelize.query('DROP SCHEMA IF EXISTS public CASCADE;');
    // await db.sequelize.query('CREATE SCHEMA public;');
<<<<<<< HEAD
<<<<<<< HEAD
    await db.sequelize.sync({ force: true });
    // await runSeeders();
=======
    console.log('Paso 2: Sincronizando modelos...');
    await db.sequelize.sync({ /*force: true */ });
    console.log('Paso 3: Corriendo Seeders...');
    await runSeeders();
    console.log('Paso 4: ¡Salimos de runSeeders() con éxito!');
    console.log('Paso 5: Conectando a Redis...');
>>>>>>> aa80fa827de682311f518faa7c737f8e1d0734b1
=======
    await db.sequelize.sync(); // { force: true } { alter: true }
    //await runSeeders();
>>>>>>> 62f78f73a7759f7dca51caaa8cf5df4af653e19e
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
