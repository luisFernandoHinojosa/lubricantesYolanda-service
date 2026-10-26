/**
 * Script de migración: número de factura autoincremental por la base de datos
 *
 * Ejecutar con: node src/scripts/migrate_numero_factura.js [numero_inicial]
 *   numero_inicial (opcional): valor mínimo con el que debe continuar la numeración,
 *   por ejemplo si el SIAT ya tiene facturas emitidas desde otro sistema.
 *
 * Este script (todo dentro de una transacción):
 * 1. Verifica que no existan números de factura repetidos
 * 2. Asigna número a las facturas que no lo tienen (PENDIENTE / ERROR), en orden de creación
 * 3. Crea la secuencia "Facturas_numero_factura_seq" y la posiciona después del mayor número
 * 4. Usa la secuencia como DEFAULT de numero_factura, y lo deja NOT NULL y UNIQUE
 */

import dotenv from 'dotenv';
dotenv.config();

import { QueryTypes } from 'sequelize';
import { sequelize } from '../database/connection.js';

const SECUENCIA = 'Facturas_numero_factura_seq';
const CONSTRAINT_UNIQUE = 'Facturas_numero_factura_key';

const numeroInicial = process.argv[2] ? parseInt(process.argv[2], 10) : 1;

const migrate = async () => {
    if (isNaN(numeroInicial) || numeroInicial < 1) {
        console.error('❌ numero_inicial debe ser un entero mayor a 0.');
        process.exit(1);
    }

    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos exitosa.\n');

        await sequelize.transaction(async (transaction) => {
            // ── PASO 1: Números repetidos ─────────────────────────────────────
            console.log('📋 Paso 1: Verificando números de factura repetidos...');
            const repetidos = await sequelize.query(`
                SELECT "numero_factura", COUNT(*)::int AS cantidad
                FROM "Facturas"
                WHERE "numero_factura" IS NOT NULL
                GROUP BY "numero_factura"
                HAVING COUNT(*) > 1;
            `, { type: QueryTypes.SELECT, transaction });

            if (repetidos.length > 0) {
                const lista = repetidos.map((r) => `#${r.numero_factura} (${r.cantidad} veces)`).join(', ');
                throw new Error(`Hay números de factura repetidos: ${lista}. Corríjalos antes de migrar.`);
            }
            console.log('   ✅ Sin repetidos.\n');

            // ── PASO 2: Asignar número a facturas sin número ──────────────────
            console.log('📋 Paso 2: Asignando número a facturas PENDIENTE/ERROR sin número...');
            const [, filas] = await sequelize.query(`
                WITH base AS (
                    SELECT GREATEST(COALESCE(MAX("numero_factura"), 0), :minimo - 1) AS ultimo
                    FROM "Facturas"
                ),
                sin_numero AS (
                    SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS fila
                    FROM "Facturas"
                    WHERE "numero_factura" IS NULL
                )
                UPDATE "Facturas" f
                SET "numero_factura" = base.ultimo + sin_numero.fila
                FROM sin_numero, base
                WHERE f."id" = sin_numero."id";
            `, { replacements: { minimo: numeroInicial }, transaction });
            console.log(`   ✅ Facturas actualizadas: ${filas?.rowCount ?? 0}.\n`);

            // ── PASO 3: Secuencia ─────────────────────────────────────────────
            console.log('📋 Paso 3: Creando la secuencia...');
            await sequelize.query(
                `CREATE SEQUENCE IF NOT EXISTS "${SECUENCIA}" OWNED BY "Facturas"."numero_factura";`,
                { transaction }
            );
            const [{ siguiente }] = await sequelize.query(`
                SELECT GREATEST(COALESCE(MAX("numero_factura"), 0) + 1, :minimo)::int AS siguiente
                FROM "Facturas";
            `, { type: QueryTypes.SELECT, replacements: { minimo: numeroInicial }, transaction });
            // is_called = false → el próximo nextval() devuelve exactamente `siguiente`
            await sequelize.query(`SELECT setval('"${SECUENCIA}"', :siguiente, false);`, {
                replacements: { siguiente },
                transaction,
            });
            console.log(`   ✅ La próxima factura será la #${siguiente}.\n`);

            // ── PASO 4: Default, NOT NULL y UNIQUE ────────────────────────────
            console.log('📋 Paso 4: Configurando la columna numero_factura...');
            await sequelize.query(`
                ALTER TABLE "Facturas"
                ALTER COLUMN "numero_factura" SET DEFAULT nextval('"${SECUENCIA}"'),
                ALTER COLUMN "numero_factura" SET NOT NULL;
            `, { transaction });

            const existeUnique = await sequelize.query(`
                SELECT 1
                FROM pg_constraint c
                JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
                WHERE c.conrelid = '"Facturas"'::regclass
                  AND c.contype = 'u'
                  AND array_length(c.conkey, 1) = 1
                  AND a.attname = 'numero_factura';
            `, { type: QueryTypes.SELECT, transaction });

            if (existeUnique.length === 0) {
                await sequelize.query(
                    `ALTER TABLE "Facturas" ADD CONSTRAINT "${CONSTRAINT_UNIQUE}" UNIQUE ("numero_factura");`,
                    { transaction }
                );
            }
            console.log('   ✅ Columna configurada (DEFAULT nextval, NOT NULL, UNIQUE).\n');
        });

        console.log('═══════════════════════════════════════════════════════');
        console.log('  🎉 MIGRACIÓN NÚMERO DE FACTURA COMPLETADA');
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
