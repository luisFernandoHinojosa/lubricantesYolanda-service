import bcrypt from 'bcrypt';
import db from '../../database/index.js';

export const seedEmpleadoUsuario = async () => {
    const count = await db.Empleado.count();
    if (count > 0) {
        console.log(`[Seeder] Empleados/Usuarios: ${count} ya existen.`);
        return;
    }

    const transaction = await db.sequelize.transaction();

    try {
        console.log('[Seeder] Buscando dependencias (Rol y Sucursal)...');

        const rolAdmin = await db.Role.findOne({
            where: { code_rol: 'SADM' }
        });

        const sucursal = await db.Sucursal.findOne();

        if (!rolAdmin) throw new Error('No se encontró el Rol ADMIN en la base de datos.');
        if (!sucursal) throw new Error('No se encontró ninguna Sucursal en la base de datos.');

        console.log('[Seeder] Generando credenciales...');
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash('12345678', salt);

        const nuevoUsuario = await db.Usuario.create({
            name_user: 'milenka123',
            email: 'sadm@lubricantesYolanda.com',
            password_hash: password_hash,
            rol_id: rolAdmin.id,
            id_sucursal: sucursal.id
        }, { transaction });

        await db.Empleado.create({
            nombre: 'Yolanda',
            apellido_paterno: 'Lubricantes',
            apellido_materno: 'Lubri',
            ci: '12345678',
            esta_activo: true,
            usuario_id: nuevoUsuario.id
        }, { transaction });

        await transaction.commit();
        console.log(`[Seeder] Empleado y Usuario Admin creados exitosamente.`);

    } catch (error) {
        await transaction.rollback();
        console.error('[Seeder] Error al crear el empleado y usuario:', error.message);
    }
}