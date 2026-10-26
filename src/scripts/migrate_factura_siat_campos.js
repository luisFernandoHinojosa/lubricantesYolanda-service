/**
 * Script de migración: campos de la respuesta del SIAT en Facturas
 *
 * Ejecutar con: node src/scripts/migrate_factura_siat_campos.js
 *
 * Este script (todo dentro de una transacción):
 * 1. Agrega las columnas url_siat, estado_siat, cufd, codigo_control, codigo_ambiente y fecha_emision
 * 2. Mueve a url_siat los enlaces del SIAT que se guardaron por error en url_factura_pdf
 */

import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from '../database/connection.js';

const COLUMNAS = [
    ['url_siat', 'TEXT'],
    ['estado_siat', 'VARCHAR(30)'],
    ['cufd', 'VARCHAR(200)'],
    ['codigo_control', 'VARCHAR(50)'],
    ['codigo_ambiente', 'SMALLINT'],
    ['fecha_emision', 'TIMESTAMP WITH TIME ZONE'],
];

const migrate = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos exitosa.\n');

        await sequelize.transaction(async (transaction) => {
            // ── PASO 1: Columnas nuevas ───────────────────────────────────────
            console.log('📋 Paso 1: Agregando columnas...');
            for (const [nombre, tipo] of COLUMNAS) {
                await sequelize.query(
                    `ALTER TABLE "Facturas" ADD COLUMN IF NOT EXISTS "${nombre}" ${tipo};`,
                    { transaction }
                );
                console.log(`   ✅ ${nombre} (${tipo})`);
            }
            console.log('');

            // ── PASO 2: Corregir enlaces del SIAT guardados como PDF ──────────
            console.log('📋 Paso 2: Moviendo enlaces del SIAT de url_factura_pdf a url_siat...');
            const [, filas] = await sequelize.query(`
                UPDATE "Facturas"
                SET "url_siat" = "url_factura_pdf",
                    "url_factura_pdf" = NULL
                WHERE "url_factura_pdf" ILIKE '%siat.impuestos.gob.bo%';
            `, { transaction });
            console.log(`   ✅ Facturas corregidas: ${filas?.rowCount ?? 0}.\n`);
        });

        console.log('═══════════════════════════════════════════════════════');
        console.log('  🎉 MIGRACIÓN CAMPOS SIAT DE FACTURAS COMPLETADA');
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
