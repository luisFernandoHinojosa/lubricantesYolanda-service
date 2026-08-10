import { seedRoles } from './roles.seeder.js';
import { seedSucursales } from './sucursal.seeder.js';
import { seedClientes } from './cliente.seeder.js';
import { seedEmpleadoUsuario } from './empleado.seeder.js';
import { seedPruebasVentas } from './pruebas.seeder.js';

export const runSeeders = async () => {
    console.log('[Seeders] Verificando datos iniciales...');
    try {
        await seedRoles();
        await seedSucursales();
        await seedClientes();
        await seedEmpleadoUsuario();
        await seedPruebasVentas();
        console.log('[Seeders] ✓ Datos iniciales verificados.');
    } catch (error) {
        console.error('[Seeders] Error al ejecutar seeders:', error);
        throw error;
    }
};