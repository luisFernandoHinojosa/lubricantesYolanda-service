// import { Sequelize, DataTypes } from 'sequelize';
// import config from '../config/index.js';
// import errorModel from '../modules/errors/error.model.js';
// import auditEventModel from '../modules/audit/audit.model.js';
// import logger from '../config/logger.js';

// const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
//   host: config.db.host,
//   port: config.db.port,
//   dialect: config.db.dialect,
//   logging: (msg) => {
//     // Usamos logger.debug para los logs de SQL para que no saturen los logs de 'info'
//     if (config.server.nodeEnv === 'development') {
//       logger.debug(msg);
//     }
//   },
// });

// const db = {};

// db.Sequelize = Sequelize;
// db.sequelize = sequelize;

// db.Error = errorModel(sequelize, DataTypes);
// db.AuditEvent = auditEventModel(sequelize, DataTypes);

// db.connectDB = async () => {
//   try {
//     await sequelize.authenticate();
//     logger.info('Database connection has been established successfully.');
//   } catch (error) {
//     logger.error('Unable to connect to the database:', error);
//     process.exit(1);
//   }
// };

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sequelize } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = {};

const loadModels = async (directory) => {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      await loadModels(fullPath);
    } else if (file.slice(-9) === '.model.js') {
      const modelImporter = await import(pathToFileURL(fullPath));
      const model = modelImporter.default(sequelize);
      db[model.name] = model;
    }
  }
};
const modulesPath = path.join(__dirname, '../modules');
await loadModels(modulesPath);

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
export default db;