/**
 * Script de migración: recargo por emitir factura en Ventas
 *
 * Ejecutar con: node src/scripts/migrate_recargo_iva_ventas.js
 *
 * Agrega a "Ventas" las columnas porcentaje_recargo_iva y monto_recargo_iva
 * (NOT NULL DEFAULT 0, así las ventas existentes quedan sin recargo).
 */

import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from '../database/connection.js';

const migrate = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos exitosa.\n');

        console.log('📋 Agregando columnas de recargo a Ventas...');
        await sequelize.query(`
            ALTER TABLE "Ventas"
            ADD COLUMN IF NOT EXISTS "porcentaje_recargo_iva" DECIMAL(5, 2) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "monto_recargo_iva" DECIMAL(10, 2) NOT NULL DEFAULT 0;
        `);
        console.log('   ✅ porcentaje_recargo_iva y monto_recargo_iva agregadas.\n');

        console.log('═══════════════════════════════════════════════════════');
        console.log('  🎉 MIGRACIÓN RECARGO IVA EN VENTAS COMPLETADA');
        console.log('═══════════════════════════════════════════════════════');
    } catch (error) {
        console.error('❌ Error durante la migración:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
};

migrate();
