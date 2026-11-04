/**
 * Prueba (solo lectura) del filtro desde/hasta del listado de ventas con datos reales.
 *
 * Ejecutar con: node src/scripts/test_filtro_fechas_ventas.js
 *
 * Para cada venta elegida (prioriza las hechas desde las 20:00 hora de Bolivia, donde el día en UTC
 * ya es el siguiente) llama a findAllVentas con desde=hasta=<día boliviano de la venta> y verifica:
 * 1. La venta aparece en su día.
 * 2. No aparece al filtrar el día anterior ni el siguiente.
 * 3. El total del listado coincide con un conteo independiente en SQL (AT TIME ZONE 'America/La_Paz').
 */

import dotenv from 'dotenv';
dotenv.config();

import { QueryTypes } from 'sequelize';
import { sequelize } from '../database/connection.js';
import { findAllVentas } from '../modules/ventas/ventas.service.js';
import { fechaLocal, ZONA_HORARIA } from '../utils/fechas.js';

const DIA_MS = 24 * 60 * 60 * 1000;
const sumarDias = (fecha, dias) => fechaLocal(new Date(new Date(`${fecha}T12:00:00-04:00`).getTime() + dias * DIA_MS));

let fallos = 0;
const verificar = (ok, mensaje) => {
    console.log(`  ${ok ? 'OK   ' : 'FALLO'} ${mensaje}`);
    if (!ok) fallos++;
};

const idsDelDia = async (dia) => {
    const { ventas } = await findAllVentas({ page: 1, perPage: 100, desde: dia, hasta: dia });
    return ventas.map((v) => v.id);
};

const probarVenta = async (v) => {
    const dia = fechaLocal(new Date(v.createdAt));
    console.log(`\nVenta ${v.numero_comprobante} | createdAt UTC ${new Date(v.createdAt).toISOString()} | día Bolivia ${dia}`);

    const [enDia, enAnterior, enSiguiente] = await Promise.all([
        idsDelDia(dia),
        idsDelDia(sumarDias(dia, -1)),
        idsDelDia(sumarDias(dia, 1)),
    ]);
    verificar(enDia.includes(v.id), `aparece al filtrar ${dia}`);
    verificar(!enAnterior.includes(v.id), `no aparece al filtrar ${sumarDias(dia, -1)}`);
    verificar(!enSiguiente.includes(v.id), `no aparece al filtrar ${sumarDias(dia, 1)}`);

    const [{ total: esperado }] = await sequelize.query(
        `SELECT COUNT(*)::int AS total FROM "Ventas" WHERE ("createdAt" AT TIME ZONE :zona)::date = :dia`,
        { replacements: { zona: ZONA_HORARIA, dia }, type: QueryTypes.SELECT }
    );
    const { total } = await findAllVentas({ page: 1, perPage: 1, desde: dia, hasta: dia });
    verificar(total === esperado, `total del listado (${total}) = conteo SQL independiente (${esperado})`);
};

try {
    // Ventas de noche (>= 20:00 Bolivia) y de madrugada (< 04:00), los bordes entre día local y día UTC
    const horaLocal = `EXTRACT(HOUR FROM "createdAt" AT TIME ZONE :zona)`;
    const select = (condicion) => sequelize.query(
        `SELECT id, numero_comprobante, "createdAt" FROM "Ventas"
         WHERE ${condicion} ORDER BY "createdAt" DESC LIMIT 3`,
        { replacements: { zona: ZONA_HORARIA }, type: QueryTypes.SELECT }
    );
    const noche = await select(`${horaLocal} >= 20`);
    const madrugada = await select(`${horaLocal} < 4`);
    const normal = await select(`${horaLocal} BETWEEN 8 AND 18`);

    console.log(`Ventas encontradas: ${noche.length} de noche (>=20h), ${madrugada.length} de madrugada (<4h), ${normal.length} de día`);
    if (noche.length === 0) console.log('AVISO: no hay ventas hechas desde las 20:00; el caso principal no se pudo probar.');

    for (const v of [...noche, ...madrugada, ...normal.slice(0, 1)]) await probarVenta(v);

    console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} verificación(es) fallaron.`);
} catch (error) {
    console.error('Error en la prueba:', error);
    fallos++;
} finally {
    await sequelize.close();
    process.exit(fallos === 0 ? 0 : 1);
}
