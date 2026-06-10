import db from '../index.js';

const SUCURSALES_INICIALES = [
    {
        nombre: 'Lubricantes Yolanda',
        direccion: 'Av. Principal Internacional',
        telefono: '72123855',
        correo_electronico: 'lubricantesyolanda@gmail.com',
        ciudad: 'Santa Cruz - San Julian',
        responsable: 'Yolanda lubricantes'
    }
]

export const seedSucursales = async () => {
    const count = await db.Sucursal.count();
    if (count > 0) {
        console.log(`[Seeder] Sucursales: ${count} ya existen.`);
        return;
    }
    await db.Sucursal.bulkCreate(SUCURSALES_INICIALES);
    console.log(`[Seeder] Sucursales: ${SUCURSALES_INICIALES.length} creadas.`);
}