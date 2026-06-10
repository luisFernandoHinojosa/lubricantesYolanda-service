/**
 * Script de migración para el módulo de Devoluciones y Cambios
 * 
 * Ejecutar con: node src/scripts/migrate_devoluciones.js
 * 
 * Este script:
 * 1. Agrega 'DEVOLUCION' al ENUM tipo_movimiento de KardexMovimientos
 * 2. Permite que Sequelize sync() cree las tablas Devoluciones y Detalle_Devoluciones
 */

import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from '../database/connection.js';

const migrate = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos exitosa.\n');

        // ── PASO 1: Agregar DEVOLUCION al ENUM de KardexMovimientos ──────────
        console.log('📋 Paso 1: Agregando DEVOLUCION al ENUM tipo_movimiento...');
        try {
            await sequelize.query(`
                ALTER TYPE "enum_KardexMovimientos_tipo_movimiento" 
                ADD VALUE IF NOT EXISTS 'DEVOLUCION';
            `);
            console.log('   ✅ ENUM actualizado.\n');
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('   ⚠️  El valor DEVOLUCION ya existe en el ENUM.\n');
            } else {
                throw e;
            }
        }

        // ── PASO 2: Limpiar tablas si existen (para re-crearlas con Sequelize) 
        console.log('📋 Paso 2: Limpiando tablas previas si existen...');
        await sequelize.query(`DROP TABLE IF EXISTS "Detalle_Devoluciones" CASCADE;`);
        await sequelize.query(`DROP TABLE IF EXISTS "Devoluciones" CASCADE;`);
        // Limpiar ENUMs que Sequelize espera crear
        await sequelize.query(`DROP TYPE IF EXISTS "enum_Devoluciones_tipo" CASCADE;`);
        await sequelize.query(`DROP TYPE IF EXISTS "enum_Devoluciones_metodo_reembolso" CASCADE;`);
        await sequelize.query(`DROP TYPE IF EXISTS "enum_Devoluciones_estado" CASCADE;`);
        console.log('   ✅ Tablas y tipos limpiados.\n');

        console.log('═══════════════════════════════════════════════════════');
        console.log('  🎉 MIGRACIÓN FASE 1 COMPLETADA');
        console.log('  Ahora reinicie el servidor para que Sequelize');
        console.log('  cree las tablas automáticamente con sync().');
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
