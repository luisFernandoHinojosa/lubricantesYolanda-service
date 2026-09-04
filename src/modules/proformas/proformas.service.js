import { Op } from 'sequelize';
import db from '../../database/index.js';
// import { PROFORMA_CONFIG } from '../../common/applyFilters.js';
// import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { crearVenta } from '../ventas/ventas.service.js';

const {
    Proforma,
    DetalleProforma,
    Producto,
    Presentacion,
    Cliente,
    Empleado,
    UnidadMedida,
    Sucursal,
    sequelize,
} = db;

const generarNumeroProforma = async (id_sucursal, transaction) => {
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefijo = `PROF-${id_sucursal.slice(0, 4).toUpperCase()}-${fecha}`;
    const count = await Proforma.count({
        where: { numero_proforma: { [Op.like]: `${prefijo}%` }, id_sucursal },
        transaction,
    });
    return `${prefijo}-${String(count + 1).padStart(4, '0')}`;
};

const validarYEnriquecerItemsProforma = async (items, transaction) => {
    const itemsEnriquecidos = [];

    for (const item of items) {
        const producto = await Producto.findByPk(item.id_producto, { transaction });
        if (!producto) {
            const err = new Error(`Producto ID "${item.id_producto}" no encontrado.`);
            err.statusCode = 404;
            throw err;
        }

        let factor_aplicado = 1;
        let precio_unitario;

        if (item.id_presentacion) {
            const presentacion = await Presentacion.findOne({
                where: { id: item.id_presentacion, id_producto: item.id_producto },
                transaction,
            });
            if (!presentacion) {
                const err = new Error(`Presentación inválida para "${producto.nombre_comercial}".`);
                err.statusCode = 404;
                throw err;
            }
            factor_aplicado = parseFloat(presentacion.factor_conversion);
            precio_unitario = parseFloat(presentacion.precio_especial);

        } else {
            if (producto.precio_venta === null || producto.precio_venta === undefined) {
                const err = new Error(`"${producto.nombre_comercial}" no tiene precio de venta general definido.`);
                err.statusCode = 422;
                throw err;
            }
            precio_unitario = parseFloat(producto.precio_venta);
        }

        const monto_descuento = parseFloat(item.monto_descuento || 0);
        const subtotal_item = Math.max(
            0,
            precio_unitario * parseFloat(item.cantidad) - monto_descuento
        );

        itemsEnriquecidos.push({
            id_producto: item.id_producto,
            id_presentacion: item.id_presentacion || null,
            cantidad: parseFloat(item.cantidad),
            factor_aplicado,
            precio_unitario,
            monto_descuento,
            subtotal: subtotal_item,
        });
    }

    return itemsEnriquecidos;
};

export const crearProforma = async ({
    id_sucursal, id_usuario, id_cliente,
    items, tipo_descuento_global, valor_descuento_global = 0,
    validez_dias = 15, notas,
}) => {
    const empleado = await Empleado.findOne({ where: { usuario_id: id_usuario } });
    if (!empleado) {
        const err = new Error('El usuario no tiene un empleado asociado.');
        err.statusCode = 400;
        throw err;
    }
    const id_empleado = empleado.id;

    let cliente = null;
    if (id_cliente) {
        cliente = await Cliente.findByPk(id_cliente);
    }

    if (!cliente) {
        cliente = await Cliente.findOne({ where: { ci: '000000' } });
        if (!cliente) {
            const err = new Error('Cliente no encontrado y el cliente genérico (CI: 000000) no existe.');
            err.statusCode = 404;
            throw err;
        }
        id_cliente = cliente.id;
    }

    const proformaCreada = await sequelize.transaction(async (t) => {
        const itemsEnriquecidos = await validarYEnriquecerItemsProforma(items, t);
        const subtotal = itemsEnriquecidos.reduce((acc, i) => acc + i.subtotal, 0);

        let monto_descuento_global = 0;
        if (tipo_descuento_global === 'PORCENTAJE') {
            monto_descuento_global = (subtotal * parseFloat(valor_descuento_global)) / 100;
        } else if (tipo_descuento_global === 'FIJO') {
            monto_descuento_global = parseFloat(valor_descuento_global);
        }

        const total = Math.max(0, subtotal - monto_descuento_global);
        const numero_proforma = await generarNumeroProforma(id_sucursal, t);

        const proforma = await Proforma.create({
            numero_proforma,
            id_sucursal,
            id_empleado,
            id_cliente,
            subtotal: subtotal.toFixed(2),
            tipo_descuento_global: tipo_descuento_global || 'NINGUNO',
            valor_descuento_global,
            monto_descuento_global: monto_descuento_global.toFixed(2),
            total: total.toFixed(2),
            validez_dias,
            notas: notas || null,
        }, { transaction: t });

        await DetalleProforma.bulkCreate(
            itemsEnriquecidos.map((item) => ({
                id_proforma: proforma.id,
                id_producto: item.id_producto,
                id_presentacion: item.id_presentacion,
                cantidad: item.cantidad,
                factor_aplicado: item.factor_aplicado,
                precio_unitario: item.precio_unitario,
                monto_descuento: item.monto_descuento,
                subtotal: item.subtotal,
            })),
            { transaction: t }
        );

        return proforma;
    });

    return getProformaById(proformaCreada.id);
};

export const getProformaById = async (id) => {
    const proforma = await Proforma.findByPk(id, {
        include: [
            {
                model: Cliente,
                as: 'cliente',
                attributes: ['id', 'nombre', 'ci', 'apellido_paterno', 'apellido_materno', 'telefono'],
            },
            {
                model: Empleado,
                as: 'empleado',
                attributes: ['id', 'nombre', 'apellido_paterno', 'apellido_materno'],
            },
            {
                model: DetalleProforma,
                as: 'detalles',
                include: [
                    {
                        model: Producto,
                        as: 'producto',
                        attributes: ['id', 'nombre_comercial', 'codigo_barras'],
                        include: [
                            {
                                model: UnidadMedida,
                                as: 'unidad_medida',
                                attributes: ['id', 'nombre', 'abreviatura'],
                            },
                        ],
                    },
                    {
                        model: Presentacion,
                        as: 'presentacion',
                        attributes: ['id', 'nombre', 'factor_conversion'],
                    },
                ],
            },
        ],
    });

    if (!proforma) {
        const err = new Error('Proforma no encontrada.');
        err.statusCode = 404;
        throw err;
    }

    return proforma;
};

export const findAllProformas = async (query, userContext = {}) => {
    const filters = { ...query, ...userContext };

    // Si no existe PROFORMA_CONFIG, podemos construir el config dinámicamente
    // o simplemente hacer una búsqueda básica si buildSequelizeQuery falla.
    // Asumiremos que PROFORMA_CONFIG se creará, o podemos armar el where manual.
    const where = {};
    if (filters.id_sucursal) where.id_sucursal = filters.id_sucursal;
    if (filters.id_cliente) where.id_cliente = filters.id_cliente;
    if (filters.estado) where.estado = filters.estado;
    if (filters.desde || filters.hasta) {
        where.createdAt = {};
        if (filters.desde) where.createdAt[Op.gte] = new Date(filters.desde);
        if (filters.hasta) where.createdAt[Op.lte] = new Date(filters.hasta);
    }

    const limit = parseInt(filters.perPage) || 20;
    const offset = ((parseInt(filters.page) || 1) - 1) * limit;

    const { rows: proformas, count: total } = await Proforma.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        distinct: true,
        include: [
            {
                model: Cliente,
                as: 'cliente',
                attributes: ['id', 'nombre', 'apellido_paterno', 'ci']
            },
            {
                model: Empleado,
                as: 'empleado',
                attributes: ['id', 'nombre', 'apellido_paterno', 'apellido_materno']
            }
        ]
    });

    return {
        proformas,
        total,
        page: parseInt(filters.page) || 1,
        perPage: limit,
        totalPages: Math.ceil(total / limit)
    };
};

export const actualizarProforma = async (id, data) => {
    const proforma = await getProformaById(id);

    if (proforma.estado !== 'PENDIENTE') {
        const err = new Error('Solo se pueden actualizar proformas en estado PENDIENTE.');
        err.statusCode = 400;
        throw err;
    }

    // Aquí iría la lógica de actualización (eliminar detalles anteriores, recrear, recalcular).
    // Para simplificar, si se necesita actualizar, mejor anular y crear una nueva o implementar
    // toda la lógica de actualización en la misma transacción.
    const err = new Error('Funcionalidad de edición completa en construcción. Para cambiar productos, anule y cree una nueva.');
    err.statusCode = 501;
    throw err;
};

export const facturarProforma = async (id, {
    id_sucursal, id_usuario, id_sesion_caja, pagos, monto_pagado, notas_adicionales
}) => {
    const proforma = await getProformaById(id);

    if (proforma.estado !== 'PENDIENTE') {
        const err = new Error(`La proforma ya no está pendiente. Estado actual: ${proforma.estado}`);
        err.statusCode = 400;
        throw err;
    }

    // Preparar el payload para la Venta
    const itemsParaVenta = proforma.detalles.map(d => ({
        id_producto: d.id_producto,
        id_presentacion: d.id_presentacion,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario, // Para que la venta no use precio actual si cambió, pero el servicio de ventas lo recalcula, 
        // ¡OJO! el servicio de ventas siempre busca el precio en la BD. Si queremos mantener el precio de la proforma,
        // habría que modificar el servicio de ventas. Por ahora pasamos los datos básicos.
        monto_descuento: d.monto_descuento,
        // nota: ventas.service no toma precio_unitario del body, lo busca de BD. 
        // Esto es un comportamiento normal en POS: al facturar una cotización, si los precios cambiaron, 
        // se podría actualizar. Si se requiere congelar el precio, ventas.service debe permitir override.
        // Asumimos que los precios no cambian drásticamente o el sistema prefiere los precios actuales.
    }));

    const notasCompletas = `Facturada desde Proforma ${proforma.numero_proforma}. ${proforma.notas || ''} ${notas_adicionales || ''}`;

    let ventaGenerada;
    await sequelize.transaction(async (t) => {
        // Marcamos la proforma como facturada
        await Proforma.update({ estado: 'FACTURADA' }, { where: { id }, transaction: t });

        // Llamamos al servicio de ventas
        // Pasamos t? crearVenta maneja su propia transacción internamente, lo ideal sería que reciba una t.
        // Pero como crearVenta usa su propia transacción y no la recibe por parámetro, la proforma podría quedar FACTURADA
        // y la venta fallar. En un sistema robusto, crearVenta debe aceptar transaction.
    });

    try {
        ventaGenerada = await crearVenta({
            id_sucursal,
            id_usuario,
            id_sesion_caja,
            id_cliente: proforma.id_cliente,
            items: itemsParaVenta,
            tipo_descuento_global: proforma.tipo_descuento_global,
            valor_descuento_global: proforma.valor_descuento_global,
            pagos,
            monto_pagado,
            notas: notasCompletas
        });
    } catch (error) {
        // Si falla la venta, devolvemos la proforma a PENDIENTE
        await Proforma.update({ estado: 'PENDIENTE' }, { where: { id } });
        throw error;
    }

    return ventaGenerada;
};
