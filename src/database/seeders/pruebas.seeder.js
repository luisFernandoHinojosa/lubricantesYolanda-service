import db from '../index.js';
import { Op } from 'sequelize';

export const seedPruebasVentas = async () => {
    console.log('[Seeders] Ejecutando seeder de Pruebas (Productos y Ventas)...');
    try {
        const {
            Categoria,
            Marca,
            UnidadMedida,
            Producto,
            Sucursal,
            Empleado,
            Cliente,
            SesionCaja,
            Venta,
            DetalleVenta
        } = db;

        // 1. Obtener dependencias base (ya deberían estar creadas por los otros seeders)
        const sucursal = await Sucursal.findOne();
        const empleado = await Empleado.findOne();
        let cliente = await Cliente.findOne({ where: { ci: '000000' } });
        if (!cliente) cliente = await Cliente.findOne();

        if (!sucursal || !empleado || !cliente) {
            console.log('[Seeders-Pruebas] Faltan datos base (Sucursal, Empleado, Cliente) para crear pruebas.');
            return;
        }

        // 2. Crear Categoria, Marca, UnidadMedida
        const [categoria] = await Categoria.findOrCreate({
            where: { nombre: 'Lubricantes' },
            defaults: { descripcion: 'Lubricantes de motor', esta_activo: true }
        });

        const [marca] = await Marca.findOrCreate({
            where: { nombre: 'Mobil' },
            defaults: { descripcion: 'Marca Mobil', esta_activo: true }
        });

        const [unidad] = await UnidadMedida.findOrCreate({
            where: { nombre: 'Litro' },
            defaults: { abreviatura: 'L', esta_activo: true }
        });

        // 3. Crear Producto de prueba
        const [producto] = await Producto.findOrCreate({
            where: { codigo_barras: 'TEST-1234' },
            defaults: {
                nombre_comercial: 'Aceite Motor 5W-30',
                id_categoria: categoria.id,
                id_marca: marca.id,
                id_unidad_medida: unidad.id,
                precio_venta: 50.00,
                stock_minimo: 10,
                maneja_vencimiento: false,
                esta_activo: true
            }
        });

        // 4. Crear Sesión de Caja (necesaria para la venta)
        const [sesionCaja] = await SesionCaja.findOrCreate({
            where: { id_empleado: empleado.id, estado: 'ABIERTA' },
            defaults: {
                id_sucursal: sucursal.id,
                fecha_apertura: new Date('2026-08-01T08:00:00Z'),
                monto_apertura: 500.00,
            }
        });

        // 5. Crear Ventas de prueba (Agosto 1 y Agosto 3)
        // Revisamos si ya existen ventas de prueba
        const ventasExisten = await Venta.count({ where: { numero_comprobante: { [Op.like]: 'TK-PRUEBA-%' } } });
        if (ventasExisten === 0) {
            // Venta del 1ro de agosto
            const v1 = await Venta.create({
                numero_comprobante: 'TK-PRUEBA-20260801-01',
                id_sucursal: sucursal.id,
                id_sesion_caja: sesionCaja.id,
                id_empleado: empleado.id,
                id_cliente: cliente.id,
                subtotal: 150.00,
                total: 150.00,
                metodo_pago: 'EFECTIVO',
                monto_pagado: 150.00,
                cambio_entregado: 0.00,
                esta_activo: true,
                createdAt: new Date('2026-08-01T14:30:00Z'),
            });
            await DetalleVenta.create({
                id_venta: v1.id,
                id_producto: producto.id,
                cantidad: 3,
                precio_unitario: 50.00,
                subtotal: 150.00,
                factor_aplicado: 1,
                monto_descuento: 0,
            });

            // Venta del 3ro de agosto (Mañana)
            const v2 = await Venta.create({
                numero_comprobante: 'TK-PRUEBA-20260803-01',
                id_sucursal: sucursal.id,
                id_sesion_caja: sesionCaja.id,
                id_empleado: empleado.id,
                id_cliente: cliente.id,
                subtotal: 100.00,
                total: 100.00,
                metodo_pago: 'QR',
                monto_pagado: 100.00,
                cambio_entregado: 0.00,
                esta_activo: true,
                createdAt: new Date('2026-08-03T09:15:00Z'),
            });
            await DetalleVenta.create({
                id_venta: v2.id,
                id_producto: producto.id,
                cantidad: 2,
                precio_unitario: 50.00,
                subtotal: 100.00,
                factor_aplicado: 1,
                monto_descuento: 0,
            });

            // Venta del 3ro de agosto (Tarde)
            const v3 = await Venta.create({
                numero_comprobante: 'TK-PRUEBA-20260803-02',
                id_sucursal: sucursal.id,
                id_sesion_caja: sesionCaja.id,
                id_empleado: empleado.id,
                id_cliente: cliente.id,
                subtotal: 250.00,
                total: 250.00,
                metodo_pago: 'TARJETA',
                monto_pagado: 250.00,
                cambio_entregado: 0.00,
                esta_activo: true,
                createdAt: new Date('2026-08-03T16:45:00Z'),
            });
            await DetalleVenta.create({
                id_venta: v3.id,
                id_producto: producto.id,
                cantidad: 5,
                precio_unitario: 50.00,
                subtotal: 250.00,
                factor_aplicado: 1,
                monto_descuento: 0,
            });

            console.log('[Seeders-Pruebas] ✓ Ventas y productos de prueba creados exitosamente.');
        } else {
            console.log('[Seeders-Pruebas] Las ventas de prueba ya existen.');
        }
    } catch (error) {
        console.error('[Seeders-Pruebas] Error al insertar datos de prueba:', error);
        throw error;
    }
};
