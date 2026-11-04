/**
 * Script de corrección: pagos que faltan por el recargo de factura
 *
 * Ejecutar con: node src/scripts/fix_pagos_recargo.js
 *
 * Facturar una venta después de registrarla (o volver a emitirla cambiando el recargo)
 * subía monto_pagado sin registrar el PagoVenta del recargo, así que la suma de los pagos
 * (que usan caja y reportes) no coincidía con monto_pagado.
 *
 * Este script (todo dentro de una transacción):
 * 1. Busca ventas activas cuyos pagos suman menos que monto_pagado
 * 2. Agrega a cada una un pago EFECTIVO por la diferencia, al final (orden max + 1)
 * 3. Solo lista las ventas cuyos pagos suman MÁS que monto_pagado (revisión manual)
 */

import dotenv from 'dotenv';
dotenv.config();

import { QueryTypes } from 'sequelize';
import { sequelize } from '../database/connection.js';

const REFERENCIA = 'Ajuste recargo por factura';

const diferenciasDePago = (transaction) => sequelize.query(`
    SELECT v.id, v.numero_comprobante,
           v.monto_pagado::numeric AS monto_pagado,
           COALESCE(SUM(p.monto), 0)::numeric AS suma_pagos,
           COALESCE(MAX(p.orden), -1) AS ultimo_orden
    FROM "Ventas" v
    LEFT JOIN "PagosVenta" p ON p.id_venta = v.id
    WHERE v.esta_activo = true
    GROUP BY v.id
    HAVING ABS(v.monto_pagado - COALESCE(SUM(p.monto), 0)) > 0.005
    ORDER BY v."createdAt";
`, { type: QueryTypes.SELECT, transaction });

const fix = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos exitosa.\n');

        await sequelize.transaction(async (transaction) => {
            const ventas = await diferenciasDePago(transaction);
            const faltantes = ventas.filter((v) => Number(v.monto_pagado) > Number(v.suma_pagos));
            const sobrantes = ventas.filter((v) => Number(v.monto_pagado) < Number(v.suma_pagos));

            // ── PASO 1: Agregar el pago que falta ─────────────────────────────
            console.log(`📋 Paso 1: Ventas con pagos faltantes (${faltantes.length})...`);
            for (const v of faltantes) {
                const diferencia = (Number(v.monto_pagado) - Number(v.suma_pagos)).toFixed(2);
                await sequelize.query(`
                    INSERT INTO "PagosVenta" (id, id_venta, metodo_pago, orden, monto, referencia, "createdAt")
                    VALUES (gen_random_uuid(), :id_venta, 'EFECTIVO', :orden, :monto, :referencia, NOW());
                `, {
                    replacements: {
                        id_venta: v.id,
                        orden: Number(v.ultimo_orden) + 1,
                        monto: diferencia,
                        referencia: REFERENCIA,
                    },
                    transaction,
                });
                console.log(`   ✅ ${v.numero_comprobante}: pagos ${v.suma_pagos} → +${diferencia} EFECTIVO (monto_pagado ${v.monto_pagado})`);
            }
            console.log('');

            // ── PASO 2: Pagos que superan monto_pagado (no se tocan) ──────────
            console.log(`📋 Paso 2: Ventas con pagos que superan monto_pagado (${sobrantes.length}, revisar a mano)...`);
            for (const v of sobrantes) {
                console.log(`   ⚠️  ${v.numero_comprobante}: pagos ${v.suma_pagos}, monto_pagado ${v.monto_pagado}`);
            }
            console.log('');
        });

        console.log('═══════════════════════════════════════════════════════');
        console.log('  🎉 CORRECCIÓN DE PAGOS DEL RECARGO COMPLETADA');
        console.log('═══════════════════════════════════════════════════════');
    } catch (error) {
        console.error('❌ Error durante la corrección (no se aplicó ningún cambio):', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
};

fix();
