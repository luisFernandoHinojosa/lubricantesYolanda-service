import { sequelize } from './src/database/connection.js';

async function run() {
    try {
        console.log('Iniciando actualización de esquema de base de datos...');

        // Lotes: id_proveedor y costo_compra_unitario
        await sequelize.query('ALTER TABLE "Lotes" ALTER COLUMN id_proveedor DROP NOT NULL;');
        await sequelize.query('ALTER TABLE "Lotes" ALTER COLUMN costo_compra_unitario DROP NOT NULL;');
        console.log('- Tabla "Lotes" actualizada.');

        // Productos: precio_venta
        await sequelize.query('ALTER TABLE "Productos" ALTER COLUMN precio_venta DROP NOT NULL;');
        console.log('- Tabla "Productos" actualizada.');

        // Presentaciones: precio_especial
        await sequelize.query('ALTER TABLE "Presentaciones" ALTER COLUMN precio_especial DROP NOT NULL;');
        console.log('- Tabla "Presentaciones" actualizada.');

        console.log('✅ Esquema actualizado correctamente.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error al actualizar el esquema:', error);
        process.exit(1);
    }
}

run();
