/**
 * Script de migración: varias facturas por venta (una sola vigente)
 *
 * Ejecutar con: node src/scripts/migrate_facturas_por_venta.js
 * Requiere haber corrido antes migrate_factura_anulacion.js (estado ANULADA).
 *
 * Este script (todo dentro de una transacción):
 * 1. Quita la restricción única de Facturas.id_venta (una venta podía tener una sola factura)
 * 2. Crea un índice único parcial: una sola factura no ANULADA por venta
 * 3. Deja una sola restricción única en numero_factura (sync({ alter: true }) agregaba
 *    una nueva en cada arranque: Facturas_numero_factura_key1, _key2, ...)
 */

import dotenv from 'dotenv';
dotenv.config();

import { QueryTypes } from 'sequelize';
import { sequelize } from '../database/connection.js';

const INDICE_VIGENTE = 'Facturas_id_venta_vigente_uk';
const UNIQUE_NUMERO_FACTURA = 'Facturas_numero_factura_key';

// Restricciones únicas de una sola columna de "Facturas"
const restriccionesUnicas = (columna, transaction) => sequelize.query(`
    SELECT c.conname AS nombre
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = '"Facturas"'::regclass
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 1
      AND a.attname = :columna
    ORDER BY c.conname;
`, { replacements: { columna }, type: QueryTypes.SELECT, transaction });

const migrate = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos exitosa.\n');

        await sequelize.transaction(async (transaction) => {
            // ── PASO 1: Restricción única de id_venta ─────────────────────────
            console.log('📋 Paso 1: Quitando la restricción única de id_venta...');
            const restricciones = await restriccionesUnicas('id_venta', transaction);

            for (const { nombre } of restricciones) {
                await sequelize.query(`ALTER TABLE "Facturas" DROP CONSTRAINT "${nombre}";`, { transaction });
                console.log(`   ✅ ${nombre} eliminada`);
            }
            if (restricciones.length === 0) {
                console.log('   ℹ️  No había restricción única en id_venta');
            }
            console.log('');

            // ── PASO 2: Índice único parcial (una factura vigente por venta) ──
            console.log('📋 Paso 2: Creando el índice de factura vigente...');
            await sequelize.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS "${INDICE_VIGENTE}"
                ON "Facturas" ("id_venta")
                WHERE "estado" <> 'ANULADA';
            `, { transaction });
            console.log(`   ✅ ${INDICE_VIGENTE}\n`);

            // ── PASO 3: Una sola restricción única en numero_factura ──────────
            console.log('📋 Paso 3: Quitando restricciones únicas repetidas de numero_factura...');
            const unicasNumero = await restriccionesUnicas('numero_factura', transaction);
            // Se conserva la original; si no existe, la primera
            const conservar = unicasNumero.some((r) => r.nombre === UNIQUE_NUMERO_FACTURA)
                ? UNIQUE_NUMERO_FACTURA
                : unicasNumero[0]?.nombre;
            const repetidas = unicasNumero.filter((r) => r.nombre !== conservar);

            for (const { nombre } of repetidas) {
                await sequelize.query(`ALTER TABLE "Facturas" DROP CONSTRAINT "${nombre}";`, { transaction });
            }
            console.log(
                `   ✅ ${repetidas.length} eliminadas; se conserva ${conservar ?? '(ninguna: falta la restricción única)'}\n`
            );
        });

        console.log('═══════════════════════════════════════════════════════');
        console.log('  🎉 MIGRACIÓN VARIAS FACTURAS POR VENTA COMPLETADA');
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
