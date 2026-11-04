/**
 * Script de migración: anulación de facturas
 *
 * Ejecutar con: node src/scripts/migrate_factura_anulacion.js
 *
 * Este script (todo dentro de una transacción):
 * 1. Agrega el estado ANULADA al ENUM de Facturas.estado
 * 2. Agrega la columna fecha_anulacion
 */

import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from '../database/connection.js';

const ENUM_ESTADO_FACTURA = 'enum_Facturas_estado';

const migrate = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos exitosa.\n');

        await sequelize.transaction(async (transaction) => {
            // ── PASO 1: Estado ANULADA ────────────────────────────────────────
            console.log('📋 Paso 1: Agregando el estado ANULADA...');
            await sequelize.query(
                `ALTER TYPE "${ENUM_ESTADO_FACTURA}" ADD VALUE IF NOT EXISTS 'ANULADA';`,
                { transaction }
            );
            console.log(`   ✅ ${ENUM_ESTADO_FACTURA}: ANULADA\n`);

            // ── PASO 2: Columna fecha_anulacion ───────────────────────────────
            console.log('📋 Paso 2: Agregando la columna fecha_anulacion...');
            await sequelize.query(
                `ALTER TABLE "Facturas" ADD COLUMN IF NOT EXISTS "fecha_anulacion" TIMESTAMP WITH TIME ZONE;`,
                { transaction }
            );
            console.log('   ✅ fecha_anulacion (TIMESTAMP WITH TIME ZONE)\n');
        });

        console.log('═══════════════════════════════════════════════════════');
        console.log('  🎉 MIGRACIÓN ANULACIÓN DE FACTURAS COMPLETADA');
        console.log('═══════════════════════════════════════════════════════');
    } catch (error) {
        console.error('❌ Error durante la migración (no se aplicó ningún cambio):', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
};

migrate();
