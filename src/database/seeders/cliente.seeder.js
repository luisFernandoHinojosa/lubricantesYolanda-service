import db from '../index.js';

const CLIENTES_INICIALES = [
    {
        nombre: 'Cliente',
        apellido_paterno: 'Default',
        ci: '000000',
        fecha_nacimiento: '1990-01-01',
        direccion: 'Sin Direccion',
        puntos: '0',
        genero: 'M',
        tipo_cliente: 'MIN'
    }
]

export const seedClientes = async () => {
    const count = await db.Cliente.count();
    if (count > 0) {
        console.log(`[Seeder] Clientes: ${count} ya existen.`);
        return;
    }
    await db.Cliente.bulkCreate(CLIENTES_INICIALES);
    console.log(`[Seeder] Clientes: ${CLIENTES_INICIALES.length} creadas.`);
}