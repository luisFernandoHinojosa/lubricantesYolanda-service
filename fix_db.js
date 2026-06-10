// import { sequelize } from './src/database/connection.js'; async function run() { await sequelize.query('ALTER TABLE \
// Ventas\ ALTER COLUMN id_cliente DROP NOT NULL;'); console.log('ALTER YES'); process.exit(0); } run().catch(console.error);
