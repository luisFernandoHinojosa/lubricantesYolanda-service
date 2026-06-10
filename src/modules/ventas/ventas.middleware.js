import db from '../../database/index.js';

const { SesionCaja } = db;

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: Verificar que el cajero tiene una sesión de caja ABIERTA.
// Adjunta `req.sesionCaja` para uso posterior en el request.
// ─────────────────────────────────────────────────────────────────────────────
export const requireSesionAbierta = async (req, res, next) => {
    try {
        const { id: id_usuario, id_sucursal } = req.user;
        const empleado = await db.Empleado.findOne({ where: { usuario_id: id_usuario } });
        if (!empleado) {
            return res.status(403).json({
                status: 403,
                message: 'El usuario no tiene un empleado asociado.',
            });
        }
        const id_empleado = empleado.id;

        const sesion = await SesionCaja.findOne({
            where: { id_empleado, id_sucursal, estado: 'ABIERTA' },
        });

        if (!sesion) {
            return res.status(403).json({
                status: 403,
                message: 'No hay sesión de caja abierta. Realice la apertura de caja primero.',
            });
        }

        // Disponible en el resto del pipeline
        req.sesionCaja = sesion;
        next();
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: Validar el cuerpo de una nueva venta.
// ─────────────────────────────────────────────────────────────────────────────
export const validateVenta = (req, res, next) => {
    const {
        id_sesion_caja, id_cliente, items,
        metodo_pago, monto_pagado,
        tipo_descuento_global, valor_descuento_global,
    } = req.body;

    const errores = [];

    // ── Campos raíz obligatorios ──────────────────────────────────────────────
    if (!id_sesion_caja) errores.push('id_sesion_caja es requerido.');
    if (!metodo_pago) errores.push('metodo_pago es requerido.');

    if (monto_pagado === undefined || monto_pagado === null)
        errores.push('monto_pagado es requerido.');
    else if (parseFloat(monto_pagado) < 0)
        errores.push('monto_pagado no puede ser negativo.');

    // ── Método de pago ────────────────────────────────────────────────────────
    const metodosValidos = ['EFECTIVO', 'QR', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'OTRO'];
    if (metodo_pago && !metodosValidos.includes(metodo_pago)) {
        errores.push(`metodo_pago debe ser uno de: ${metodosValidos.join(', ')}.`);
    }

    // ── Items ─────────────────────────────────────────────────────────────────
    if (!Array.isArray(items) || items.length === 0) {
        errores.push('items debe ser un array con al menos un producto.');
    } else {
        // Detectar items duplicados (mismo id_producto + id_presentacion)
        const claves = items.map(
            (i) => `${i.id_producto}::${i.id_presentacion || 'unidad'}`
        );
        const clavesUnicas = new Set(claves);
        if (clavesUnicas.size !== claves.length) {
            errores.push('items contiene productos duplicados. Agrupe en un solo ítem con mayor cantidad.');
        }

        items.forEach((item, idx) => {
            const base = `items[${idx}]`;

            if (!item.id_producto)
                errores.push(`${base}.id_producto es requerido.`);

            if (!item.cantidad || isNaN(parseFloat(item.cantidad)) || parseFloat(item.cantidad) <= 0)
                errores.push(`${base}.cantidad debe ser un número mayor a 0.`);

            // precio_unitario NO es obligatorio en el body — el service lo obtiene de BD.
            // Si se envía, solo validamos que no sea un número extraño.
            if (item.precio_unitario !== undefined) {
                if (isNaN(parseFloat(item.precio_unitario)) || parseFloat(item.precio_unitario) < 0)
                    errores.push(`${base}.precio_unitario inválido (el sistema usará el precio del lote).`);
            }

            if (item.monto_descuento !== undefined) {
                if (isNaN(parseFloat(item.monto_descuento)) || parseFloat(item.monto_descuento) < 0)
                    errores.push(`${base}.monto_descuento no puede ser negativo.`);
            }

            // numero_serie: si se envía debe ser un string no vacío.
            // La validación de si el producto realmente requiere serie la hace el service
            // consultando Producto.maneja_serie en BD.
            if (item.numero_serie !== undefined && item.numero_serie !== null) {
                if (typeof item.numero_serie !== 'string' || !item.numero_serie.trim()) {
                    errores.push(`${base}.numero_serie debe ser un texto no vacío si se proporciona.`);
                }
            }
        });
    }

    // ── Descuento global ──────────────────────────────────────────────────────
    if (tipo_descuento_global !== undefined && tipo_descuento_global !== null) {
        const tiposValidos = ['PORCENTAJE', 'FIJO', 'NINGUNO'];
        if (!tiposValidos.includes(tipo_descuento_global)) {
            errores.push(`tipo_descuento_global debe ser: ${tiposValidos.join(' | ')}.`);
        }
        if (valor_descuento_global === undefined || valor_descuento_global === null) {
            errores.push('valor_descuento_global es requerido cuando se especifica tipo_descuento_global.');
        } else {
            if (isNaN(parseFloat(valor_descuento_global)) || parseFloat(valor_descuento_global) < 0)
                errores.push('valor_descuento_global debe ser un número >= 0.');
            if (tipo_descuento_global === 'PORCENTAJE' && parseFloat(valor_descuento_global) > 100)
                errores.push('El porcentaje de descuento no puede superar 100%.');
        }
    }

    if (errores.length > 0) {
        return res.status(400).json({
            status: 400,
            mensaje: 'Error de validación en los datos de la venta.',
            errores,
        });
    }

    next();
};

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: Validar apertura de caja.
// ─────────────────────────────────────────────────────────────────────────────
export const validateAperturaCaja = (req, res, next) => {
    const { monto_apertura } = req.body;
    const errores = [];

    if (monto_apertura === undefined || monto_apertura === null) {
        errores.push('monto_apertura es requerido.');
    } else if (parseFloat(monto_apertura) < 0) {
        errores.push('monto_apertura no puede ser negativo.');
    }

    if (errores.length > 0) {
        return res.status(400).json({ status: 400, mensaje: 'Datos de apertura inválidos.', errores });
    }
    next();
};

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: Validar cierre de caja.
// ─────────────────────────────────────────────────────────────────────────────
export const validateCierreCaja = (req, res, next) => {
    const { monto_cierre } = req.body;
    const errores = [];

    if (monto_cierre === undefined || monto_cierre === null) {
        errores.push('monto_cierre es requerido.');
    } else if (parseFloat(monto_cierre) < 0) {
        errores.push('monto_cierre no puede ser negativo.');
    }

    if (errores.length > 0) {
        return res.status(400).json({ status: 400, mensaje: 'Datos de cierre inválidos.', errores });
    }
    next();
};