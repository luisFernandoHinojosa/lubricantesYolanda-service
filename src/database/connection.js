import { Sequelize } from 'sequelize';
import config from '../config/index.js';
import logger from '../config/logger.js';

// export const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
//   host: config.db.host,
//   port: config.db.port,
//   dialect: config.db.dialect,
let urlDB
if (config.server.nodeEnv === 'development') {
  urlDB = `postgresql://${config.db.user}:${config.db.password}@${config.db.host}:${config.db.port}/${config.db.name}`
} else {
  // para trabajar con docker imagen
  urlDB = config.db.dbUrlPro
}

export const sequelize = new Sequelize(urlDB, {
  dialect: config.db.dialect,
  logging: (msg) => {
    if (config.server.nodeEnv === 'development') {
      logger.debug(msg);
    }
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});