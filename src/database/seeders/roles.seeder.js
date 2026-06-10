import db from '../index.js';

const ROLES_INICIALES = [
    {
        nombre_rol: 'Super_Admin',
        code_rol: 'SADM',
        descripcion: 'Super Administrador del sistema',
        estado: 'ACTIVO'
    },
    {
        nombre_rol: 'Administrador',
        code_rol: 'ADM',
        descripcion: 'Administrador del sistema',
        estado: 'ACTIVO'
    },
    {
        nombre_rol: 'Cajero',
        code_rol: 'CAJ',
        descripcion: 'Cajero del sistema',
        estado: 'ACTIVO'
    },
    {
        nombre_rol: 'Almacenero',
        code_rol: 'ALM',
        descripcion: 'Almacenero del sistema',
        estado: 'ACTIVO'
    },
    {
        nombre_rol: 'Vendedor',
        code_rol: 'VEN',
        descripcion: 'Vendedor del sistema',
        estado: 'ACTIVO'
    }
]

export const seedRoles = async () => {
    const count = await db.Role.count();
    if (count > 0) {
        console.log(`[Seeder] Roles: ${count} ya existen.`);
        return;
    }
    await db.Role.bulkCreate(ROLES_INICIALES);
    console.log(`[Seeder] Roles: ${ROLES_INICIALES.length} creados.`);
}