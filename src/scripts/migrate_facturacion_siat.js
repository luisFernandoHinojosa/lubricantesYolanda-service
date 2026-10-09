/**
 * Script de migración para adaptar Clientes y PagosVenta a los catálogos del SIAT
 *
 * Ejecutar con: node src/scripts/migrate_facturacion_siat.js
 *
 * Este script (todo dentro de una transacción):
 * 1. Agrega las columnas tipo_documento y complemento a Clientes
 * 2. Recrea el ENUM metodo_pago de PagosVenta con los métodos del SIAT
 * 3. Recrea el ENUM tipoPago de Movimientos (TRANSFERENCIA → QR, OTRO → OTROS)
 * 4. Agrega la columna orden a PagosVenta
 */

import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from '../database/connection.js';
import { METODOS_PAGO_VALIDOS } from '../constants/business.constants.js';

const ENUM_METODO_PAGO = 'enum_PagosVenta_metodo_pago';
const ENUM_TIPO_PAGO = 'enum_Movimientos_tipoPago';

const migrate = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos exitosa.\n');

        await sequelize.transaction(async (transaction) => {
            // ── PASO 1: Columnas fiscales en Clientes ─────────────────────────
            console.log('📋 Paso 1: Agregando tipo_documento y complemento a Clientes...');
            await sequelize.query(`
                ALTER TABLE "Clientes"
                ADD COLUMN IF NOT EXISTS "tipo_documento" INTEGER NOT NULL DEFAULT 1,
                ADD COLUMN IF NOT EXISTS "complemento" VARCHAR(5);
            `, { transaction });
            console.log('   ✅ Columnas agregadas.\n');

            // ── PASO 2: Recrear ENUM metodo_pago ──────────────────────────────
            console.log('📋 Paso 2: Recreando ENUM metodo_pago con los métodos del SIAT...');
            const valores = METODOS_PAGO_VALIDOS.map((v) => `'${v}'`).join(', ');
            await sequelize.query(`ALTER TYPE "${ENUM_METODO_PAGO}" RENAME TO "${ENUM_METODO_PAGO}_old";`, { transaction });
            await sequelize.query(`CREATE TYPE "${ENUM_METODO_PAGO}" AS ENUM (${valores});`, { transaction });
            await sequelize.query(`
                ALTER TABLE "PagosVenta"
                ALTER COLUMN "metodo_pago" TYPE "${ENUM_METODO_PAGO}"
                USING "metodo_pago"::text::"${ENUM_METODO_PAGO}";
            `, { transaction });
            await sequelize.query(`DROP TYPE "${ENUM_METODO_PAGO}_old";`, { transaction });
            console.log(`   ✅ ENUM actualizado: ${METODOS_PAGO_VALIDOS.join(', ')}.\n`);

            // ── PASO 2b: Recrear ENUM tipoPago de Movimientos ─────────────────
            // Valores antiguos sin equivalente directo: TRANSFERENCIA → QR, OTRO → OTROS
            console.log('📋 Paso 2b: Recreando ENUM tipoPago de Movimientos...');
            await sequelize.query(`ALTER TYPE "${ENUM_TIPO_PAGO}" RENAME TO "${ENUM_TIPO_PAGO}_old";`, { transaction });
            await sequelize.query(`CREATE TYPE "${ENUM_TIPO_PAGO}" AS ENUM (${valores});`, { transaction });
            await sequelize.query(`
                ALTER TABLE "Movimientos"
                ALTER COLUMN "tipoPago" TYPE "${ENUM_TIPO_PAGO}"
                USING (CASE "tipoPago"::text
                    WHEN 'TRANSFERENCIA' THEN 'QR'
                    WHEN 'OTRO' THEN 'OTROS'
                    ELSE "tipoPago"::text
                END)::"${ENUM_TIPO_PAGO}";
            `, { transaction });
            await sequelize.query(`DROP TYPE "${ENUM_TIPO_PAGO}_old";`, { transaction });
            console.log('   ✅ ENUM tipoPago actualizado.\n');

            // ── PASO 3: Columna orden en PagosVenta ───────────────────────────
            console.log('📋 Paso 3: Agregando columna orden a PagosVenta...');
            await sequelize.query(`
                ALTER TABLE "PagosVenta"
                ADD COLUMN IF NOT EXISTS "orden" INTEGER NOT NULL DEFAULT 0;
            `, { transaction });
            console.log('   ✅ Columna agregada.\n');
        });

        console.log('═══════════════════════════════════════════════════════');
        console.log('  🎉 MIGRACIÓN SIAT COMPLETADA');
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
